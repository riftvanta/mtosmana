'use client';

import React, { useState, useEffect } from 'react';
import {
  Order,
  OrderStatus,
  ConnectionStatus
} from '@/types';
import {
  getWorkflowEngine,
  WorkflowEventType,
  WorkflowTask,
  WorkflowEvent
} from '@/lib/workflowEngine';
import { getOrders } from '@/lib/orderOperations';
import {
  collection,
  query,
  where,
  orderBy,
  limit,
  onSnapshot,
  getDocs
} from 'firebase/firestore';
import { db } from '@/lib/firebase';
import OrderStatusWorkflow from './OrderStatusWorkflow';
import RealTimeNotifications from './RealTimeNotifications';

interface AdminWorkflowDashboardProps {
  className?: string;
}

interface SystemHealth {
  uptime: number;
  activeTasks: number;
  completedTasksToday: number;
  failedTasksToday: number;
  avgResponseTime: number;
  errorRate: number;
  throughput: number;
}

interface WorkflowMetrics {
  totalOrders: number;
  pendingOrders: number;
  processingOrders: number;
  completedToday: number;
  averageProcessingTime: number;
  taskCompletionRate: number;
  systemLoad: number;
}

const AdminWorkflowDashboard: React.FC<AdminWorkflowDashboardProps> = ({
  className = ''
}) => {
  const [workflowEngine] = useState(() => getWorkflowEngine());
  const [activeView, setActiveView] = useState<'overview' | 'orders' | 'tasks' | 'events' | 'system'>('overview');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Data state
  const [recentOrders, setRecentOrders] = useState<Order[]>([]);
  const [activeTasks, setActiveTasks] = useState<WorkflowTask[]>([]);
  const [recentEvents, setRecentEvents] = useState<WorkflowEvent[]>([]);
  const [systemHealth, setSystemHealth] = useState<SystemHealth>({
    uptime: 0,
    activeTasks: 0,
    completedTasksToday: 0,
    failedTasksToday: 0,
    avgResponseTime: 0,
    errorRate: 0,
    throughput: 0
  });
  const [workflowMetrics, setWorkflowMetrics] = useState<WorkflowMetrics>({
    totalOrders: 0,
    pendingOrders: 0,
    processingOrders: 0,
    completedToday: 0,
    averageProcessingTime: 0,
    taskCompletionRate: 0,
    systemLoad: 0
  });
  const [connectionStatus, setConnectionStatus] = useState<ConnectionStatus>({
    isConnected: true,
    isReconnecting: false,
    connectionQuality: 'excellent'
  });

  // Real-time data loading
  useEffect(() => {
    loadInitialData();
    setupRealTimeListeners();
    startMetricsCollection();

    return () => {
      // Cleanup listeners
    };
  }, []);

  const loadInitialData = async () => {
    setLoading(true);
    try {
      await Promise.all([
        loadRecentOrders(),
        loadActiveTasks(),
        loadRecentEvents(),
        loadSystemMetrics()
      ]);
    } catch (err) {
      console.error('Error loading initial data:', err);
      setError('Failed to load dashboard data');
    } finally {
      setLoading(false);
    }
  };

  const loadRecentOrders = async () => {
    try {
      const result = await getOrders(
        { status: ['submitted', 'pending_review', 'approved', 'processing'] },
        { field: 'created', direction: 'desc' },
        { page: 1, limit: 10 }
      );
      setRecentOrders(result.items);
    } catch (error) {
      console.error('Error loading recent orders:', error);
    }
  };

  const loadActiveTasks = async () => {
    try {
      // Simple query to avoid index requirements
      const q = query(
        collection(db, 'workflowTasks'),
        orderBy('scheduledAt', 'desc'),
        limit(20)
      );
      const snapshot = await getDocs(q);
      const allTasks = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      })) as WorkflowTask[];
      
      // Filter in memory to avoid complex indices
      const activeTasks = allTasks.filter(task => 
        task.status === 'pending' || task.status === 'executing'
      );
      setActiveTasks(activeTasks);
    } catch (error) {
      console.warn('Error loading active tasks, using empty array:', error);
      setActiveTasks([]);
    }
  };

  const loadRecentEvents = async () => {
    try {
      const q = query(
        collection(db, 'workflowEvents'),
        orderBy('timestamp', 'desc'),
        limit(20)
      );
      const snapshot = await getDocs(q);
      const events = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      })) as WorkflowEvent[];
      setRecentEvents(events);
    } catch (error) {
      console.warn('Error loading recent events, using empty array:', error);
      setRecentEvents([]);
    }
  };

  const loadSystemMetrics = async () => {
    try {
      const today = new Date();
      const startOfDay = new Date(today.getFullYear(), today.getMonth(), today.getDate());
      
      const stats = await workflowEngine.getWorkflowStatistics(startOfDay, today);
      
      setSystemHealth({
        uptime: Date.now() - startOfDay.getTime(),
        activeTasks: activeTasks.length,
        completedTasksToday: stats.completedTasks,
        failedTasksToday: stats.failedTasks,
        avgResponseTime: stats.avgExecutionTime,
        errorRate: stats.errorRate,
        throughput: stats.totalTasks
      });

      // Calculate workflow metrics
      const pendingOrders = recentOrders.filter(o => ['submitted', 'pending_review'].includes(o.status)).length;
      const processingOrders = recentOrders.filter(o => ['approved', 'processing'].includes(o.status)).length;
      const completedToday = recentOrders.filter(o => 
        o.status === 'completed' && 
        new Date(o.timestamps.completed || 0).toDateString() === today.toDateString()
      ).length;

      setWorkflowMetrics({
        totalOrders: recentOrders.length,
        pendingOrders,
        processingOrders,
        completedToday,
        averageProcessingTime: stats.avgExecutionTime / 1000 / 60, // Convert to minutes
        taskCompletionRate: stats.totalTasks > 0 ? (stats.completedTasks / stats.totalTasks) * 100 : 0,
        systemLoad: Math.min(100, (activeTasks.length / 50) * 100) // Assume 50 is max capacity
      });
    } catch (error) {
      console.error('Error loading system metrics:', error);
    }
  };

  const setupRealTimeListeners = () => {
    // Listen for order changes
    const ordersQuery = query(
      collection(db, 'orders'),
      where('status', 'in', ['submitted', 'pending_review', 'approved', 'processing']),
      orderBy('timestamps.created', 'desc'),
      limit(20)
    );

    const unsubscribeOrders = onSnapshot(ordersQuery, (snapshot) => {
      const orders = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      })) as Order[];
      setRecentOrders(orders);
      setConnectionStatus(prev => ({ ...prev, isConnected: true }));
    }, (error) => {
      console.error('Orders listener error:', error);
      setConnectionStatus(prev => ({ ...prev, isConnected: false }));
    });

    // Listen for task changes
    const tasksQuery = query(
      collection(db, 'workflowTasks'),
      where('status', 'in', ['pending', 'executing']),
      orderBy('scheduledAt', 'desc'),
      limit(20)
    );

    const unsubscribeTasks = onSnapshot(tasksQuery, (snapshot) => {
      const tasks = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      })) as WorkflowTask[];
      setActiveTasks(tasks);
    });

    // Listen for workflow events
    const eventsQuery = query(
      collection(db, 'workflowEvents'),
      orderBy('timestamp', 'desc'),
      limit(20)
    );

    const unsubscribeEvents = onSnapshot(eventsQuery, (snapshot) => {
      const events = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      })) as WorkflowEvent[];
      setRecentEvents(events);
    });

    return () => {
      unsubscribeOrders();
      unsubscribeTasks();
      unsubscribeEvents();
    };
  };

  const startMetricsCollection = () => {
    const interval = setInterval(() => {
      loadSystemMetrics();
    }, 30000); // Update every 30 seconds

    return () => clearInterval(interval);
  };

  const getStatusColor = (status: OrderStatus | WorkflowTask['status']): string => {
    switch (status) {
      case 'submitted': return 'bg-blue-100 text-blue-800';
      case 'pending_review': 
      case 'pending': return 'bg-yellow-100 text-yellow-800';
      case 'approved': return 'bg-green-100 text-green-800';
      case 'processing': 
      case 'executing': return 'bg-purple-100 text-purple-800';
      case 'completed': return 'bg-green-100 text-green-800';
      case 'failed': return 'bg-red-100 text-red-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  const getEventTypeColor = (type: WorkflowEventType): string => {
    switch (type) {
      case 'task_completed': return 'text-green-600';
      case 'task_failed': return 'text-red-600';
      case 'task_started': return 'text-blue-600';
      case 'workflow_completed': return 'text-green-600';
      case 'workflow_failed': return 'text-red-600';
      default: return 'text-gray-600';
    }
  };

  const handleBulkAction = async (action: 'approve' | 'reject' | 'process', orderIds: string[]) => {
    try {
      const promises = orderIds.map(orderId => 
        workflowEngine.executeStatusTransition(
          orderId,
          action === 'approve' ? 'approved' : action === 'reject' ? 'rejected' : 'processing',
          'admin',
          'admin',
          { notes: `Bulk ${action} action` }
        )
      );
      
      await Promise.all(promises);
      loadRecentOrders(); // Refresh data
    } catch (error) {
      console.error(`Error performing bulk ${action}:`, error);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
        <span className="ml-2 text-gray-600">Loading dashboard...</span>
      </div>
    );
  }

  return (
    <div className={`space-y-6 ${className}`}>
      {/* Header with Real-time Status */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Workflow Dashboard</h1>
          <p className="text-gray-600">Real-time order processing and workflow management</p>
        </div>
        
        <div className="flex items-center space-x-4">
          {/* Connection Status */}
          <div className={`flex items-center px-3 py-1 rounded-full text-sm ${
            connectionStatus.isConnected 
              ? 'bg-green-100 text-green-800' 
              : 'bg-red-100 text-red-800'
          }`}>
            <div className={`w-2 h-2 rounded-full mr-2 ${
              connectionStatus.isConnected ? 'bg-green-500' : 'bg-red-500'
            } ${connectionStatus.isReconnecting ? 'animate-pulse' : ''}`} />
            {connectionStatus.isConnected ? 'Connected' : 'Disconnected'}
          </div>
          
          {/* Notifications */}
          <RealTimeNotifications />
        </div>
      </div>

      {/* Navigation Tabs */}
      <div className="border-b border-gray-200">
        <nav className="-mb-px flex space-x-8">
          {[
            { id: 'overview', label: 'Overview', icon: '📊' },
            { id: 'orders', label: 'Active Orders', icon: '📋' },
            { id: 'tasks', label: 'Workflow Tasks', icon: '⚙️' },
            { id: 'events', label: 'System Events', icon: '📈' },
            { id: 'system', label: 'System Health', icon: '💻' }
          ].map(tab => (
            <button
              key={tab.id}
              onClick={() => setActiveView(tab.id as 'overview' | 'orders' | 'tasks' | 'events' | 'system')}
              className={`py-2 px-1 border-b-2 font-medium text-sm ${
                activeView === tab.id
                  ? 'border-blue-500 text-blue-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
              }`}
            >
              <span className="mr-2">{tab.icon}</span>
              {tab.label}
            </button>
          ))}
        </nav>
      </div>

      {/* Error Display */}
      {error && (
        <div className="bg-red-50 border border-red-200 rounded-md p-4">
          <div className="flex">
            <div className="flex-shrink-0">
              <svg className="h-5 w-5 text-red-400" viewBox="0 0 20 20" fill="currentColor">
                <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
              </svg>
            </div>
            <div className="ml-3">
              <p className="text-sm text-red-800">{error}</p>
            </div>
            <div className="ml-auto pl-3">
              <button
                onClick={() => setError(null)}
                className="text-red-400 hover:text-red-600"
              >
                <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Overview Tab */}
      {activeView === 'overview' && (
        <div className="space-y-6">
          {/* Key Metrics Cards */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            <div className="bg-white p-6 rounded-lg shadow border">
              <div className="flex items-center">
                <div className="p-2 bg-blue-100 rounded-lg">
                  <svg className="w-6 h-6 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                  </svg>
                </div>
                <div className="ml-4">
                  <p className="text-sm font-medium text-gray-600">Active Orders</p>
                  <p className="text-2xl font-semibold text-gray-900">{workflowMetrics.totalOrders}</p>
                  <p className="text-sm text-gray-500">
                    {workflowMetrics.pendingOrders} pending • {workflowMetrics.processingOrders} processing
                  </p>
                </div>
              </div>
            </div>

            <div className="bg-white p-6 rounded-lg shadow border">
              <div className="flex items-center">
                <div className="p-2 bg-green-100 rounded-lg">
                  <svg className="w-6 h-6 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                  </svg>
                </div>
                <div className="ml-4">
                  <p className="text-sm font-medium text-gray-600">Completed Today</p>
                  <p className="text-2xl font-semibold text-gray-900">{workflowMetrics.completedToday}</p>
                  <p className="text-sm text-gray-500">
                    {workflowMetrics.taskCompletionRate.toFixed(1)}% completion rate
                  </p>
                </div>
              </div>
            </div>

            <div className="bg-white p-6 rounded-lg shadow border">
              <div className="flex items-center">
                <div className="p-2 bg-purple-100 rounded-lg">
                  <svg className="w-6 h-6 text-purple-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                </div>
                <div className="ml-4">
                  <p className="text-sm font-medium text-gray-600">Avg. Processing Time</p>
                  <p className="text-2xl font-semibold text-gray-900">
                    {workflowMetrics.averageProcessingTime.toFixed(1)}m
                  </p>
                  <p className="text-sm text-gray-500">
                    {systemHealth.activeTasks} active tasks
                  </p>
                </div>
              </div>
            </div>

            <div className="bg-white p-6 rounded-lg shadow border">
              <div className="flex items-center">
                <div className="p-2 bg-yellow-100 rounded-lg">
                  <svg className="w-6 h-6 text-yellow-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                </div>
                <div className="ml-4">
                  <p className="text-sm font-medium text-gray-600">System Load</p>
                  <p className="text-2xl font-semibold text-gray-900">{workflowMetrics.systemLoad.toFixed(1)}%</p>
                  <p className="text-sm text-gray-500">
                    {systemHealth.errorRate.toFixed(1)}% error rate
                  </p>
                </div>
              </div>
            </div>
          </div>

          {/* Recent Activity */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Recent Orders */}
            <div className="bg-white rounded-lg shadow border">
              <div className="px-6 py-4 border-b border-gray-200">
                <h3 className="text-lg font-medium text-gray-900">Recent Orders</h3>
              </div>
              <div className="p-6">
                <div className="space-y-3">
                  {recentOrders.slice(0, 5).map(order => (
                    <div key={order.id} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                      <div>
                        <div className="font-medium text-sm">{order.orderId}</div>
                        <div className="text-xs text-gray-500">
                          {order.type} • {order.submittedAmount} JOD
                        </div>
                      </div>
                      <span className={`px-2 py-1 text-xs font-medium rounded-full ${getStatusColor(order.status)}`}>
                        {order.status.replace('_', ' ')}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {/* Active Tasks */}
            <div className="bg-white rounded-lg shadow border">
              <div className="px-6 py-4 border-b border-gray-200">
                <h3 className="text-lg font-medium text-gray-900">Active Workflow Tasks</h3>
              </div>
              <div className="p-6">
                <div className="space-y-3">
                  {activeTasks.slice(0, 5).map(task => (
                    <div key={task.id} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                      <div>
                        <div className="font-medium text-sm">{task.action.replace('_', ' ')}</div>
                        <div className="text-xs text-gray-500">
                          Order: {task.orderId} • Priority: {task.priority}
                        </div>
                      </div>
                      <div className="flex items-center">
                        {task.status === 'executing' && (
                          <div className="w-2 h-2 bg-blue-500 rounded-full animate-pulse mr-2" />
                        )}
                        <span className={`px-2 py-1 text-xs font-medium rounded-full ${getStatusColor(task.status)}`}>
                          {task.status}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Orders Tab */}
      {activeView === 'orders' && (
        <div className="bg-white rounded-lg shadow border">
          <div className="px-6 py-4 border-b border-gray-200">
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-medium text-gray-900">Active Orders Management</h3>
              <div className="flex space-x-2">
                <button
                  onClick={() => handleBulkAction('approve', recentOrders.filter(o => o.status === 'pending_review').map(o => o.orderId))}
                  className="px-3 py-1 bg-green-600 text-white text-sm rounded hover:bg-green-700"
                >
                  Bulk Approve
                </button>
                <button
                  onClick={() => handleBulkAction('process', recentOrders.filter(o => o.status === 'approved').map(o => o.orderId))}
                  className="px-3 py-1 bg-purple-600 text-white text-sm rounded hover:bg-purple-700"
                >
                  Bulk Process
                </button>
              </div>
            </div>
          </div>
          <div className="p-6">
            <div className="space-y-4">
              {recentOrders.map(order => (
                <div key={order.id} className="border rounded-lg p-4">
                  <OrderStatusWorkflow
                    order={order}
                    onOrderUpdated={(updatedOrder) => {
                      setRecentOrders(prev => prev.map(o => o.id === updatedOrder.id ? updatedOrder : o));
                    }}
                    userRole="admin"
                  />
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Tasks Tab */}
      {activeView === 'tasks' && (
        <div className="bg-white rounded-lg shadow border">
          <div className="px-6 py-4 border-b border-gray-200">
            <h3 className="text-lg font-medium text-gray-900">Workflow Tasks</h3>
          </div>
          <div className="p-6">
            <div className="space-y-4">
              {activeTasks.map(task => (
                <div key={task.id} className="border rounded-lg p-4">
                  <div className="flex items-center justify-between mb-2">
                    <div>
                      <div className="font-medium">{task.action.replace('_', ' ').toUpperCase()}</div>
                      <div className="text-sm text-gray-500">Order: {task.orderId}</div>
                    </div>
                    <span className={`px-3 py-1 text-sm font-medium rounded-full ${getStatusColor(task.status)}`}>
                      {task.status}
                    </span>
                  </div>
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                    <div>
                      <span className="text-gray-500">Priority:</span>
                      <div className="font-medium">{task.priority}</div>
                    </div>
                    <div>
                      <span className="text-gray-500">Retries:</span>
                      <div className="font-medium">{task.retryCount}/{task.maxRetries}</div>
                    </div>
                    <div>
                      <span className="text-gray-500">Scheduled:</span>
                      <div className="font-medium">{new Date(task.scheduledAt).toLocaleTimeString()}</div>
                    </div>
                    <div>
                      <span className="text-gray-500">Target:</span>
                      <div className="font-medium">{task.targetStatus}</div>
                    </div>
                  </div>
                  {task.error && (
                    <div className="mt-2 p-2 bg-red-50 border border-red-200 rounded text-sm text-red-800">
                      Error: {task.error}
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Events Tab */}
      {activeView === 'events' && (
        <div className="bg-white rounded-lg shadow border">
          <div className="px-6 py-4 border-b border-gray-200">
            <h3 className="text-lg font-medium text-gray-900">System Events</h3>
          </div>
          <div className="p-6">
            <div className="space-y-3">
              {recentEvents.map(event => (
                <div key={event.id} className="flex items-start p-3 bg-gray-50 rounded-lg">
                  <div className={`w-3 h-3 rounded-full mt-1 mr-3 ${getEventTypeColor(event.type).replace('text-', 'bg-')}`} />
                  <div className="flex-grow">
                    <div className="flex items-center justify-between">
                      <div className={`font-medium text-sm ${getEventTypeColor(event.type)}`}>
                        {event.type.replace('_', ' ').toUpperCase()}
                      </div>
                      <div className="text-xs text-gray-500">
                        {new Date(event.timestamp).toLocaleTimeString()}
                      </div>
                    </div>
                    <div className="text-sm text-gray-600">
                      Order: {event.orderId}
                      {event.taskId && ` • Task: ${event.taskId.slice(0, 8)}...`}
                    </div>
                    {Object.keys(event.details).length > 0 && (
                      <div className="text-xs text-gray-500 mt-1">
                        {Object.entries(event.details).map(([key, value]) => (
                          <span key={key} className="mr-3">
                            {key}: {String(value)}
                          </span>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* System Health Tab */}
      {activeView === 'system' && (
        <div className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {/* System Status */}
            <div className="bg-white p-6 rounded-lg shadow border">
              <h4 className="font-medium text-gray-900 mb-4">System Status</h4>
              <div className="space-y-3">
                <div className="flex justify-between">
                  <span className="text-gray-600">Uptime</span>
                  <span className="font-medium">{Math.floor(systemHealth.uptime / (1000 * 60 * 60))}h</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-600">Active Tasks</span>
                  <span className="font-medium">{systemHealth.activeTasks}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-600">Throughput</span>
                  <span className="font-medium">{systemHealth.throughput}/day</span>
                </div>
              </div>
            </div>

            {/* Performance Metrics */}
            <div className="bg-white p-6 rounded-lg shadow border">
              <h4 className="font-medium text-gray-900 mb-4">Performance</h4>
              <div className="space-y-3">
                <div className="flex justify-between">
                  <span className="text-gray-600">Avg Response Time</span>
                  <span className="font-medium">{systemHealth.avgResponseTime.toFixed(0)}ms</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-600">Error Rate</span>
                  <span className="font-medium">{systemHealth.errorRate.toFixed(1)}%</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-600">Completion Rate</span>
                  <span className="font-medium">{workflowMetrics.taskCompletionRate.toFixed(1)}%</span>
                </div>
              </div>
            </div>

            {/* Task Statistics */}
            <div className="bg-white p-6 rounded-lg shadow border">
              <h4 className="font-medium text-gray-900 mb-4">Today&apos;s Tasks</h4>
              <div className="space-y-3">
                <div className="flex justify-between">
                  <span className="text-gray-600">Completed</span>
                  <span className="font-medium text-green-600">{systemHealth.completedTasksToday}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-600">Failed</span>
                  <span className="font-medium text-red-600">{systemHealth.failedTasksToday}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-600">Success Rate</span>
                  <span className="font-medium">
                    {systemHealth.completedTasksToday + systemHealth.failedTasksToday > 0
                      ? ((systemHealth.completedTasksToday / (systemHealth.completedTasksToday + systemHealth.failedTasksToday)) * 100).toFixed(1)
                      : 0}%
                  </span>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default AdminWorkflowDashboard; 