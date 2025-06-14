import {
  Order,
  OrderStatus,
  OrderAction,
  OrderWorkflowAction,
  User,
  Notification,
  NotificationType,
  ActivityLog
} from '@/types';
import {
  updateOrderStatus,
  createWorkflowAction,
  getOrder,
  getNextAllowedStatuses,
  isValidStatusTransition
} from './orderOperations';
import {
  collection,
  doc,
  addDoc,
  updateDoc,
  onSnapshot,
  query,
  where,
  orderBy,
  serverTimestamp,
  runTransaction,
  Timestamp
} from 'firebase/firestore';
import { db } from './firebase';

// Workflow Engine Configuration
export interface WorkflowConfig {
  maxRetries: number;
  retryDelayMs: number;
  timeoutMs: number;
  enableAutoTransitions: boolean;
  enableRealTimeUpdates: boolean;
  notificationSettings: {
    enabled: boolean;
    channels: ('in-app' | 'email' | 'sms')[];
  };
}

const DEFAULT_WORKFLOW_CONFIG: WorkflowConfig = {
  maxRetries: 3,
  retryDelayMs: 5000,
  timeoutMs: 300000, // 5 minutes
  enableAutoTransitions: true,
  enableRealTimeUpdates: true,
  notificationSettings: {
    enabled: true,
    channels: ['in-app']
  }
};

// Workflow Task Definition
export interface WorkflowTask {
  id: string;
  orderId: string;
  action: OrderAction;
  targetStatus: OrderStatus;
  performedBy: string;
  performedByRole: 'admin' | 'exchange';
  priority: 'low' | 'normal' | 'high' | 'critical';
  scheduledAt: Date;
  executedAt?: Date;
  completedAt?: Date;
  failedAt?: Date;
  retryCount: number;
  maxRetries: number;
  status: 'pending' | 'executing' | 'completed' | 'failed' | 'cancelled';
  error?: string;
  metadata?: Record<string, string | number | boolean>;
  dependencies?: string[]; // Task IDs that must complete first
  conditions?: WorkflowCondition[];
}

export interface WorkflowCondition {
  type: 'time_based' | 'amount_based' | 'user_based' | 'custom';
  operator: 'equals' | 'greater_than' | 'less_than' | 'contains';
  field: string;
  value: string | number | boolean;
  description: string;
}

// Workflow Event Types
export type WorkflowEventType = 
  | 'task_scheduled'
  | 'task_started'
  | 'task_completed'
  | 'task_failed'
  | 'task_retried'
  | 'task_cancelled'
  | 'workflow_completed'
  | 'workflow_failed'
  | 'status_changed'
  | 'notification_sent';

export interface WorkflowEvent {
  id: string;
  orderId: string;
  taskId?: string;
  type: WorkflowEventType;
  timestamp: Date;
  details: Record<string, string | number | boolean>;
  severity: 'info' | 'warning' | 'error' | 'critical';
}

// Real-time Workflow Manager
export class WorkflowEngine {
  private config: WorkflowConfig;
  private activeListeners: Map<string, () => void> = new Map();
  private taskQueue: WorkflowTask[] = [];
  private isProcessing = false;

  constructor(config: Partial<WorkflowConfig> = {}) {
    this.config = { ...DEFAULT_WORKFLOW_CONFIG, ...config };
  }

  /**
   * Schedule a workflow task
   */
  async scheduleTask(task: Omit<WorkflowTask, 'id' | 'status' | 'retryCount'>): Promise<string> {
    const workflowTask: WorkflowTask = {
      ...task,
      id: crypto.randomUUID(),
      status: 'pending',
      retryCount: 0,
      maxRetries: task.maxRetries || this.config.maxRetries
    };

    // Save task to Firestore
    const taskRef = await addDoc(collection(db, 'workflowTasks'), workflowTask);
    workflowTask.id = taskRef.id;

    // Add to local queue
    this.taskQueue.push(workflowTask);

    // Log workflow event
    await this.logWorkflowEvent({
      orderId: task.orderId,
      taskId: workflowTask.id,
      type: 'task_scheduled',
      timestamp: new Date(),
      details: {
        action: task.action,
        targetStatus: task.targetStatus,
        priority: task.priority
      },
      severity: 'info'
    });

    // Start processing if not already running
    if (!this.isProcessing) {
      this.processTaskQueue();
    }

    return workflowTask.id;
  }

  /**
   * Execute order status transition with workflow validation
   */
  async executeStatusTransition(
    orderId: string,
    newStatus: OrderStatus,
    performedBy: string,
    performedByRole: 'admin' | 'exchange',
    options: {
      notes?: string;
      reason?: string;
      skipValidation?: boolean;
      priority?: 'low' | 'normal' | 'high' | 'critical';
      conditions?: WorkflowCondition[];
    } = {}
  ): Promise<{ success: boolean; error?: string; taskId?: string }> {
    try {
      // Get current order
      const order = await getOrder(orderId);
      if (!order) {
        return { success: false, error: 'Order not found' };
      }

      // Validate transition unless skipped
      if (!options.skipValidation && !isValidStatusTransition(order.status, newStatus, performedByRole)) {
        return { 
          success: false, 
          error: `Invalid status transition from ${order.status} to ${newStatus} for ${performedByRole}` 
        };
      }

      // Check workflow conditions
      if (options.conditions) {
        const conditionResult = await this.evaluateConditions(order, options.conditions);
        if (!conditionResult.passed) {
          return { 
            success: false, 
            error: `Workflow condition failed: ${conditionResult.failedCondition}` 
          };
        }
      }

      // Determine the action type
      const action = this.getActionFromTransition(order.status, newStatus);

      // Schedule workflow task
      const taskId = await this.scheduleTask({
        orderId,
        action,
        targetStatus: newStatus,
        performedBy,
        performedByRole,
        priority: options.priority || 'normal',
        scheduledAt: new Date(),
        maxRetries: this.config.maxRetries,
        metadata: {
          notes: options.notes || '',
          reason: options.reason || '',
          previousStatus: order.status
        },
        conditions: options.conditions
      });

      return { success: true, taskId };
    } catch (error) {
      console.error('Error executing status transition:', error);
      return { success: false, error: 'Internal error during status transition' };
    }
  }

  /**
   * Process the task queue
   */
  private async processTaskQueue(): Promise<void> {
    if (this.isProcessing) return;
    this.isProcessing = true;

    try {
      while (this.taskQueue.length > 0) {
        // Sort by priority and scheduled time
        this.taskQueue.sort((a, b) => {
          const priorityOrder = { critical: 4, high: 3, normal: 2, low: 1 };
          const priorityDiff = priorityOrder[b.priority] - priorityOrder[a.priority];
          if (priorityDiff !== 0) return priorityDiff;
          return a.scheduledAt.getTime() - b.scheduledAt.getTime();
        });

        const task = this.taskQueue.shift()!;
        await this.executeTask(task);
      }
    } finally {
      this.isProcessing = false;
    }
  }

  /**
   * Execute a single workflow task
   */
  private async executeTask(task: WorkflowTask): Promise<void> {
    try {
      // Update task status to executing
      await this.updateTaskStatus(task.id, 'executing', { executedAt: new Date() });

      // Log task started
      await this.logWorkflowEvent({
        orderId: task.orderId,
        taskId: task.id,
        type: 'task_started',
        timestamp: new Date(),
        details: {
          action: task.action,
          targetStatus: task.targetStatus,
          attempt: task.retryCount + 1
        },
        severity: 'info'
      });

      // Check dependencies
      if (task.dependencies && task.dependencies.length > 0) {
        const dependenciesMet = await this.checkDependencies(task.dependencies);
        if (!dependenciesMet) {
          throw new Error('Task dependencies not met');
        }
      }

      // Execute the actual status update
      const success = await updateOrderStatus(
        task.orderId,
        task.targetStatus,
        task.performedBy,
        task.performedByRole,
        task.metadata?.notes as string,
        task.metadata?.reason as string
      );

      if (!success) {
        throw new Error('Failed to update order status');
      }

      // Send notifications
      if (this.config.notificationSettings.enabled) {
        await this.sendStatusChangeNotification(task);
      }

      // Update task to completed
      await this.updateTaskStatus(task.id, 'completed', { completedAt: new Date() });

      // Log completion
      await this.logWorkflowEvent({
        orderId: task.orderId,
        taskId: task.id,
        type: 'task_completed',
        timestamp: new Date(),
        details: {
          action: task.action,
          targetStatus: task.targetStatus,
          duration: Date.now() - task.executedAt!.getTime()
        },
        severity: 'info'
      });

      // Check for auto-transitions
      if (this.config.enableAutoTransitions) {
        await this.checkAutoTransitions(task.orderId, task.targetStatus);
      }

    } catch (error) {
      console.error(`Error executing task ${task.id}:`, error);
      await this.handleTaskFailure(task, error as Error);
    }
  }

  /**
   * Handle task failure with retry logic
   */
  private async handleTaskFailure(task: WorkflowTask, error: Error): Promise<void> {
    const shouldRetry = task.retryCount < task.maxRetries;

    if (shouldRetry) {
      // Schedule retry
      const retryTask = {
        ...task,
        retryCount: task.retryCount + 1,
        scheduledAt: new Date(Date.now() + this.config.retryDelayMs),
        status: 'pending' as const,
        error: error.message
      };

      // Update task with retry info
      await this.updateTaskStatus(task.id, 'pending', {
        retryCount: retryTask.retryCount,
        error: error.message,
        scheduledAt: retryTask.scheduledAt
      });

      // Add back to queue
      this.taskQueue.push(retryTask);

      // Log retry
      await this.logWorkflowEvent({
        orderId: task.orderId,
        taskId: task.id,
        type: 'task_retried',
        timestamp: new Date(),
        details: {
          error: error.message,
          retryCount: retryTask.retryCount,
          maxRetries: task.maxRetries
        },
        severity: 'warning'
      });
    } else {
      // Mark as failed
      await this.updateTaskStatus(task.id, 'failed', {
        failedAt: new Date(),
        error: error.message
      });

      // Log failure
      await this.logWorkflowEvent({
        orderId: task.orderId,
        taskId: task.id,
        type: 'task_failed',
        timestamp: new Date(),
        details: {
          error: error.message,
          finalRetryCount: task.retryCount
        },
        severity: 'error'
      });

      // Send failure notification
      await this.sendTaskFailureNotification(task, error.message);
    }
  }

  /**
   * Update task status in Firestore
   */
  private async updateTaskStatus(
    taskId: string, 
    status: WorkflowTask['status'], 
    updates: Partial<WorkflowTask> = {}
  ): Promise<void> {
    const taskRef = doc(db, 'workflowTasks', taskId);
    await updateDoc(taskRef, {
      status,
      ...updates,
      updatedAt: serverTimestamp()
    });
  }

  /**
   * Check if task dependencies are met
   */
  private async checkDependencies(dependencyIds: string[]): Promise<boolean> {
    try {
      const dependencyChecks = await Promise.all(
        dependencyIds.map(async (depId) => {
          const taskRef = doc(db, 'workflowTasks', depId);
          const taskSnap = await taskRef.get();
          const taskData = taskSnap.data() as WorkflowTask | undefined;
          return taskData?.status === 'completed';
        })
      );

      return dependencyChecks.every(Boolean);
    } catch (error) {
      console.error('Error checking dependencies:', error);
      return false;
    }
  }

  /**
   * Evaluate workflow conditions
   */
  private async evaluateConditions(
    order: Order, 
    conditions: WorkflowCondition[]
  ): Promise<{ passed: boolean; failedCondition?: string }> {
    for (const condition of conditions) {
      const result = await this.evaluateCondition(order, condition);
      if (!result) {
        return { 
          passed: false, 
          failedCondition: condition.description 
        };
      }
    }
    return { passed: true };
  }

  /**
   * Evaluate a single condition
   */
  private async evaluateCondition(order: Order, condition: WorkflowCondition): Promise<boolean> {
    try {
      let fieldValue: string | number | boolean;

      // Extract field value from order
      switch (condition.field) {
        case 'amount':
          fieldValue = order.submittedAmount;
          break;
        case 'type':
          fieldValue = order.type;
          break;
        case 'priority':
          fieldValue = order.priority;
          break;
        case 'exchangeId':
          fieldValue = order.exchangeId;
          break;
        case 'created_hours_ago':
          fieldValue = (Date.now() - new Date(order.timestamps.created).getTime()) / (1000 * 60 * 60);
          break;
        default:
          return true; // Unknown field, pass by default
      }

      // Apply operator
      switch (condition.operator) {
        case 'equals':
          return fieldValue === condition.value;
        case 'greater_than':
          return typeof fieldValue === 'number' && typeof condition.value === 'number' && 
                 fieldValue > condition.value;
        case 'less_than':
          return typeof fieldValue === 'number' && typeof condition.value === 'number' && 
                 fieldValue < condition.value;
        case 'contains':
          return typeof fieldValue === 'string' && typeof condition.value === 'string' && 
                 fieldValue.includes(condition.value);
        default:
          return true;
      }
    } catch (error) {
      console.error('Error evaluating condition:', error);
      return false;
    }
  }

  /**
   * Check for automatic status transitions
   */
  private async checkAutoTransitions(orderId: string, currentStatus: OrderStatus): Promise<void> {
    const autoTransitionRules: Record<OrderStatus, { 
      condition: (order: Order) => Promise<boolean>; 
      targetStatus: OrderStatus; 
      delay?: number; 
    }[]> = {
      'submitted': [
        {
          condition: async (order) => order.type === 'incoming' && order.screenshots.length > 0,
          targetStatus: 'pending_review',
          delay: 1000 // 1 second delay
        }
      ],
      'approved': [
        {
          condition: async (order) => order.type === 'outgoing',
          targetStatus: 'processing',
          delay: 5000 // 5 second delay
        }
      ],
      'processing': [
        {
          condition: async (order) => {
            // Auto-complete low-value orders after some time (demo purposes)
            return order.submittedAmount < 100 && 
                   Date.now() - new Date(order.timestamps.processing || order.timestamps.created).getTime() > 30000;
          },
          targetStatus: 'completed',
          delay: 30000 // 30 seconds
        }
      ],
      // Other statuses don't have auto-transitions
      'pending_review': [],
      'rejected': [],
      'completed': [],
      'cancelled': [],
      'cancellation_requested': []
    };

    const rules = autoTransitionRules[currentStatus] || [];
    if (rules.length === 0) return;

    const order = await getOrder(orderId);
    if (!order) return;

    for (const rule of rules) {
      const shouldTransition = await rule.condition(order);
      if (shouldTransition) {
        // Schedule auto-transition
        setTimeout(async () => {
          try {
            await this.executeStatusTransition(
              orderId,
              rule.targetStatus,
              'system',
              'admin',
              {
                notes: 'Automatic transition by workflow engine',
                reason: 'Auto-transition rule triggered',
                priority: 'normal'
              }
            );
          } catch (error) {
            console.error('Error in auto-transition:', error);
          }
        }, rule.delay || 0);
        
        break; // Only apply the first matching rule
      }
    }
  }

  /**
   * Send status change notification
   */
  private async sendStatusChangeNotification(task: WorkflowTask): Promise<void> {
    try {
      const order = await getOrder(task.orderId);
      if (!order) return;

      // Determine notification type
      let notificationType: NotificationType;
      switch (task.targetStatus) {
        case 'approved':
          notificationType = 'order_approved';
          break;
        case 'rejected':
          notificationType = 'order_rejected';
          break;
        case 'completed':
          notificationType = 'order_completed';
          break;
        case 'cancelled':
          notificationType = 'order_cancelled';
          break;
        default:
          notificationType = 'order_status_changed';
      }

      // Create notification for exchange user
      const notification: Omit<Notification, 'id'> = {
        userId: order.exchangeId,
        type: notificationType,
        title: `Order ${order.orderId} ${task.targetStatus.replace('_', ' ')}`,
        message: `Your ${order.type} transfer of ${order.submittedAmount} JOD has been ${task.targetStatus.replace('_', ' ')}.`,
        orderId: order.orderId,
        priority: task.priority === 'critical' ? 'critical' : 'normal',
        isRead: false,
        actionUrl: `/orders/${order.orderId}`,
        actionText: 'View Order',
        metadata: {
          action: task.action,
          previousStatus: task.metadata?.previousStatus as string,
          newStatus: task.targetStatus
        },
        createdAt: new Date()
      };

      await addDoc(collection(db, 'notifications'), notification);

      // Log notification event
      await this.logWorkflowEvent({
        orderId: task.orderId,
        taskId: task.id,
        type: 'notification_sent',
        timestamp: new Date(),
        details: {
          notificationType,
          userId: order.exchangeId,
          channel: 'in-app'
        },
        severity: 'info'
      });
    } catch (error) {
      console.error('Error sending notification:', error);
    }
  }

  /**
   * Send task failure notification
   */
  private async sendTaskFailureNotification(task: WorkflowTask, errorMessage: string): Promise<void> {
    try {
      // Send notification to admin about task failure
      const notification: Omit<Notification, 'id'> = {
        userId: 'admin', // This should be actual admin user IDs
        type: 'system_alert',
        title: 'Workflow Task Failed',
        message: `Task ${task.action} for order ${task.orderId} failed after ${task.retryCount} retries: ${errorMessage}`,
        orderId: task.orderId,
        priority: 'high',
        isRead: false,
        metadata: {
          taskId: task.id,
          action: task.action,
          error: errorMessage,
          retryCount: task.retryCount.toString()
        },
        createdAt: new Date()
      };

      await addDoc(collection(db, 'notifications'), notification);
    } catch (error) {
      console.error('Error sending failure notification:', error);
    }
  }

  /**
   * Log workflow event
   */
  private async logWorkflowEvent(event: Omit<WorkflowEvent, 'id'>): Promise<void> {
    try {
      await addDoc(collection(db, 'workflowEvents'), {
        ...event,
        id: crypto.randomUUID()
      });
    } catch (error) {
      console.error('Error logging workflow event:', error);
    }
  }

  /**
   * Get action type from status transition
   */
  private getActionFromTransition(fromStatus: OrderStatus, toStatus: OrderStatus): OrderAction {
    if (toStatus === 'pending_review') return 'submit';
    if (toStatus === 'approved') return 'approve';
    if (toStatus === 'rejected') return 'reject';
    if (toStatus === 'processing') return 'process';
    if (toStatus === 'completed') return 'complete';
    if (toStatus === 'cancelled') return 'cancel';
    if (toStatus === 'cancellation_requested') return 'request_cancellation';
    return 'edit';
  }

  /**
   * Start real-time monitoring for an order
   */
  startOrderMonitoring(orderId: string, callback: (order: Order) => void): string {
    const listenerId = crypto.randomUUID();
    
    const q = query(
      collection(db, 'orders'),
      where('orderId', '==', orderId)
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      snapshot.docChanges().forEach((change) => {
        if (change.type === 'modified') {
          const order = { id: change.doc.id, ...change.doc.data() } as Order;
          callback(order);
        }
      });
    });

    this.activeListeners.set(listenerId, unsubscribe);
    return listenerId;
  }

  /**
   * Stop monitoring an order
   */
  stopOrderMonitoring(listenerId: string): void {
    const unsubscribe = this.activeListeners.get(listenerId);
    if (unsubscribe) {
      unsubscribe();
      this.activeListeners.delete(listenerId);
    }
  }

  /**
   * Get workflow statistics
   */
  async getWorkflowStatistics(startDate: Date, endDate: Date): Promise<{
    totalTasks: number;
    completedTasks: number;
    failedTasks: number;
    avgExecutionTime: number;
    retryRate: number;
    errorRate: number;
  }> {
    try {
      const q = query(
        collection(db, 'workflowTasks'),
        where('scheduledAt', '>=', startDate),
        where('scheduledAt', '<=', endDate)
      );

      const snapshot = await getDocs(q);
      const tasks = snapshot.docs.map(doc => doc.data() as WorkflowTask);

      const totalTasks = tasks.length;
      const completedTasks = tasks.filter(t => t.status === 'completed').length;
      const failedTasks = tasks.filter(t => t.status === 'failed').length;
      
      const executionTimes = tasks
        .filter(t => t.executedAt && t.completedAt)
        .map(t => t.completedAt!.getTime() - t.executedAt!.getTime());
      
      const avgExecutionTime = executionTimes.length > 0 
        ? executionTimes.reduce((sum, time) => sum + time, 0) / executionTimes.length 
        : 0;

      const totalRetries = tasks.reduce((sum, task) => sum + task.retryCount, 0);
      const retryRate = totalTasks > 0 ? (totalRetries / totalTasks) * 100 : 0;
      const errorRate = totalTasks > 0 ? (failedTasks / totalTasks) * 100 : 0;

      return {
        totalTasks,
        completedTasks,
        failedTasks,
        avgExecutionTime,
        retryRate,
        errorRate
      };
    } catch (error) {
      console.error('Error getting workflow statistics:', error);
      throw error;
    }
  }

  /**
   * Cleanup completed tasks older than specified days
   */
  async cleanupOldTasks(daysOld: number = 30): Promise<number> {
    try {
      const cutoffDate = new Date(Date.now() - (daysOld * 24 * 60 * 60 * 1000));
      
      const q = query(
        collection(db, 'workflowTasks'),
        where('status', '==', 'completed'),
        where('completedAt', '<=', cutoffDate)
      );

      const snapshot = await getDocs(q);
      let deletedCount = 0;

      // Delete in batches to avoid hitting Firestore limits
      for (const docSnap of snapshot.docs) {
        await docSnap.ref.delete();
        deletedCount++;
      }

      return deletedCount;
    } catch (error) {
      console.error('Error cleaning up old tasks:', error);
      throw error;
    }
  }

  /**
   * Shutdown the workflow engine
   */
  shutdown(): void {
    // Stop all active listeners
    this.activeListeners.forEach(unsubscribe => unsubscribe());
    this.activeListeners.clear();
    
    // Clear task queue
    this.taskQueue = [];
    this.isProcessing = false;
  }
}

// Singleton instance
let workflowEngineInstance: WorkflowEngine | null = null;

/**
 * Get the global workflow engine instance
 */
export function getWorkflowEngine(): WorkflowEngine {
  if (!workflowEngineInstance) {
    workflowEngineInstance = new WorkflowEngine();
  }
  return workflowEngineInstance;
}

/**
 * Initialize workflow engine with custom config
 */
export function initializeWorkflowEngine(config: Partial<WorkflowConfig>): WorkflowEngine {
  workflowEngineInstance = new WorkflowEngine(config);
  return workflowEngineInstance;
}

// Export types and utilities
export type { WorkflowConfig, WorkflowTask, WorkflowCondition, WorkflowEvent, WorkflowEventType }; 