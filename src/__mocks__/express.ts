import { Request, Response } from 'express';
import { EventEmitter } from 'events';

export interface MockResponse extends Partial<Response> {
  status: jest.Mock;
  send: jest.Mock;
  json: jest.Mock;
  end: jest.Mock;
  setHeader: jest.Mock;
  getHeader: jest.Mock;
}

export interface MockRequest extends Partial<Request> {
  body?: any;
  headers?: Record<string, string>;
  query?: Record<string, string>;
  params?: Record<string, string>;
}

export interface MockServer extends EventEmitter {
  on: jest.Mock;
  emit: jest.Mock;
  close: jest.Mock;
}

export interface MockApp {
  use: jest.Mock;
  post: jest.Mock;
  get: jest.Mock;
  listen: jest.Mock;
}

export interface MockExpress {
  (): MockApp;
  json: jest.Mock;
  urlencoded: jest.Mock;
  static: jest.Mock;
}

// Create mock response factory
const createMockResponse = (): MockResponse => {
  const res: MockResponse = {
    status: jest.fn().mockReturnThis(),
    send: jest.fn().mockReturnThis(),
    json: jest.fn().mockReturnThis(),
    end: jest.fn().mockReturnThis(),
    setHeader: jest.fn().mockReturnThis(),
    getHeader: jest.fn(),
  };
  return res;
};

// Create mock server factory with direct EventEmitter usage
const createMockServer = (): MockServer => {
  const server = new EventEmitter() as MockServer;
  server.on = jest.fn().mockImplementation((event: string, handler: (...args: any[]) => void) => {
    server.addListener(event, handler);
    return server;
  });
  server.emit = jest.fn().mockImplementation((event: string, ...args: any[]) => {
    return EventEmitter.prototype.emit.call(server, event, ...args);
  });
  server.close = jest.fn().mockImplementation((callback?: () => void) => {
    if (callback) callback();
    return server;
  });
  return server;
};

// Create mock app factory with enhanced functionality
const createMockApp = (server: MockServer): MockApp => ({
  use: jest.fn(),
  post: jest.fn(),
  get: jest.fn(),
  listen: jest.fn((port: number, cb?: () => void) => {
    if (cb) cb();
    return server;
  }),
});

// Create mock express factory with additional middleware support
const createMockExpress = (): MockExpress => {
  const mockServer = createMockServer();
  const mockApp = createMockApp(mockServer);

  const mockExpress = jest.fn(() => mockApp) as unknown as MockExpress;
  mockExpress.json = jest.fn(() => (req: Request, res: Response, next: () => void) => next());
  mockExpress.urlencoded = jest.fn(() => (req: Request, res: Response, next: () => void) => next());
  mockExpress.static = jest.fn(() => (req: Request, res: Response, next: () => void) => next());

  return mockExpress;
};

export default createMockExpress();
