/**
 * 网络管理器
 * 提供网络请求调度和连接管理功能
 */

import { logger } from './Logger';

export interface RequestConfig {
  url: string;
  method?: 'GET' | 'POST' | 'PUT' | 'DELETE';
  headers?: Record<string, string>;
  body?: unknown;
  timeout?: number;
  retries?: number;
  retryDelay?: number;
  abortSignal?: AbortSignal;
}

export interface RequestResult<T = unknown> {
  data: T;
  status: number;
  headers: Headers;
  url: string;
}

export interface RequestError {
  message: string;
  status?: number;
  url: string;
  isTimeout: boolean;
  isAborted: boolean;
  isNetworkError: boolean;
}

export class NetworkManager {
  private static instance: NetworkManager;
  private activeRequests: Map<string, AbortController> = new Map();
  private requestQueue: Array<() => Promise<unknown>> = [];
  private maxConcurrentRequests = 6;
  private currentRequests = 0;
  private defaultTimeout = 30000;
  private defaultRetries = 3;
  private defaultRetryDelay = 1000;

  private constructor() {}

  static getInstance(): NetworkManager {
    if (!NetworkManager.instance) {
      NetworkManager.instance = new NetworkManager();
    }
    return NetworkManager.instance;
  }

  /**
   * 设置最大并发请求数
   */
  setMaxConcurrentRequests(max: number): void {
    this.maxConcurrentRequests = max;
  }

  /**
   * 设置默认超时时间
   */
  setDefaultTimeout(timeout: number): void {
    this.defaultTimeout = timeout;
  }

  /**
   * 设置默认重试次数
   */
  setDefaultRetries(retries: number): void {
    this.defaultRetries = retries;
  }

  /**
   * 设置默认重试延迟
   */
  setDefaultRetryDelay(delay: number): void {
    this.defaultRetryDelay = delay;
  }

  /**
   * 发送HTTP请求
   */
  async request<T = unknown>(config: RequestConfig): Promise<RequestResult<T>> {
    return new Promise((resolve, reject) => {
      const requestExecutor = async () => {
        try {
          const result = await this.executeRequest<T>(config);
          resolve(result);
        } catch (error) {
          reject(error);
        } finally {
          this.currentRequests--;
          this.processQueue();
        }
      };

      if (this.currentRequests < this.maxConcurrentRequests) {
        this.currentRequests++;
        requestExecutor();
      } else {
        this.requestQueue.push(requestExecutor);
      }
    });
  }

  /**
   * 执行HTTP请求
   */
  private async executeRequest<T>(config: RequestConfig): Promise<RequestResult<T>> {
    const {
      url,
      method = 'GET',
      headers = {},
      body,
      timeout = this.defaultTimeout,
      retries = this.defaultRetries,
      retryDelay = this.defaultRetryDelay,
      abortSignal,
    } = config;

    const requestId = `${method}-${url}-${Date.now()}`;
    let lastError: RequestError | null = null;

    for (let attempt = 0; attempt <= retries; attempt++) {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), timeout);

      // 如果提供了外部的AbortSignal，也要监听它
      if (abortSignal) {
        abortSignal.addEventListener('abort', () => controller.abort());
      }

      this.activeRequests.set(requestId, controller);

      try {
        logger.debug(`Making request attempt ${attempt + 1}/${retries + 1}`, 'NetworkManager', {
          method,
          url,
          attempt: attempt + 1,
        });

        const fetchOptions: RequestInit = {
          method,
          headers: {
            'Content-Type': 'application/json',
            ...headers,
          },
          signal: controller.signal,
        };

        if (body !== undefined) {
          fetchOptions.body = JSON.stringify(body);
        }

        const response = await fetch(url, fetchOptions);

        clearTimeout(timeoutId);
        this.activeRequests.delete(requestId);

        if (!response.ok) {
          throw new Error(`HTTP ${response.status}: ${response.statusText}`);
        }

        let data: T;
        const contentType = response.headers.get('content-type');

        if (contentType?.includes('application/json')) {
          data = await response.json();
        } else if (contentType?.includes('text/')) {
          data = (await response.text()) as T;
        } else {
          data = (await response.arrayBuffer()) as T;
        }

        logger.debug(`Request successful`, 'NetworkManager', {
          method,
          url,
          status: response.status,
          attempt: attempt + 1,
        });

        return {
          data,
          status: response.status,
          headers: response.headers,
          url,
        };
      } catch (error) {
        clearTimeout(timeoutId);
        this.activeRequests.delete(requestId);

        const isAborted = error instanceof Error && error.name === 'AbortError';
        const isTimeout = isAborted && !abortSignal?.aborted;
        const isNetworkError = error instanceof TypeError;

        lastError = {
          message: error instanceof Error ? error.message : 'Unknown error',
          url,
          isTimeout,
          isAborted,
          isNetworkError,
        };

        logger.warn(`Request failed (attempt ${attempt + 1}/${retries + 1})`, 'NetworkManager', {
          method,
          url,
          error: lastError.message,
          attempt: attempt + 1,
        });

        // 如果是最后一次尝试，或者是用户取消的请求，不再重试
        if (attempt === retries || (isAborted && abortSignal?.aborted)) {
          break;
        }

        // 等待重试延迟
        if (retryDelay > 0) {
          await this.delay(retryDelay * Math.pow(2, attempt)); // 指数退避
        }
      }
    }

    throw lastError;
  }

  /**
   * GET请求
   */
  async get<T = unknown>(url: string, config?: Omit<RequestConfig, 'url' | 'method'>): Promise<RequestResult<T>> {
    return this.request<T>({ ...config, url, method: 'GET' });
  }

  /**
   * POST请求
   */
  async post<T = unknown>(
    url: string,
    body?: unknown,
    config?: Omit<RequestConfig, 'url' | 'method' | 'body'>
  ): Promise<RequestResult<T>> {
    return this.request<T>({ ...config, url, method: 'POST', body });
  }

  /**
   * PUT请求
   */
  async put<T = unknown>(
    url: string,
    body?: unknown,
    config?: Omit<RequestConfig, 'url' | 'method' | 'body'>
  ): Promise<RequestResult<T>> {
    return this.request<T>({ ...config, url, method: 'PUT', body });
  }

  /**
   * DELETE请求
   */
  async delete<T = unknown>(url: string, config?: Omit<RequestConfig, 'url' | 'method'>): Promise<RequestResult<T>> {
    return this.request<T>({ ...config, url, method: 'DELETE' });
  }

  /**
   * 取消请求
   */
  cancelRequest(requestId: string): void {
    const controller = this.activeRequests.get(requestId);
    if (controller) {
      controller.abort();
      this.activeRequests.delete(requestId);
    }
  }

  /**
   * 取消所有请求
   */
  cancelAllRequests(): void {
    this.activeRequests.forEach(controller => {
      controller.abort();
    });
    this.activeRequests.clear();
    this.requestQueue = [];
    this.currentRequests = 0;
  }

  /**
   * 处理请求队列
   */
  private processQueue(): void {
    if (this.requestQueue.length > 0 && this.currentRequests < this.maxConcurrentRequests) {
      const nextRequest = this.requestQueue.shift();
      if (nextRequest) {
        this.currentRequests++;
        nextRequest();
      }
    }
  }

  /**
   * 延迟函数
   */
  private delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  /**
   * 获取活跃请求数量
   */
  getActiveRequestCount(): number {
    return this.currentRequests;
  }

  /**
   * 获取队列中的请求数量
   */
  getQueuedRequestCount(): number {
    return this.requestQueue.length;
  }

  /**
   * 检查网络连接状态
   */
  isOnline(): boolean {
    return navigator.onLine;
  }

  /**
   * 监听网络状态变化
   */
  onNetworkStatusChange(callback: (isOnline: boolean) => void): () => void {
    const onOnline = () => callback(true);
    const onOffline = () => callback(false);

    window.addEventListener('online', onOnline);
    window.addEventListener('offline', onOffline);

    return () => {
      window.removeEventListener('online', onOnline);
      window.removeEventListener('offline', onOffline);
    };
  }
}

// 创建全局实例
export const networkManager = NetworkManager.getInstance();
