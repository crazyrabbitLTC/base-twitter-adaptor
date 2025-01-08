import { Request, Response } from 'express';
import { EventEmitter } from 'events';

export interface MockResponse extends Partial<Response> {
  status: jest.Mock;
  send: jest.Mock;
  json: jest.Mock;
}

export interface MockRequest extends Partial<Request> {
  body?: any;
}

export interface MockServer extends EventEmitter {
  on: jest.Mock;
}

export interface MockApp {
  use: jest.Mock;
  post: jest.Mock;
  listen: jest.Mock;
}

export interface MockExpress {
  (): MockApp;
  json: jest.Mock;
}

// Create mock server factory
const createMockServer = (): MockServer => {
  const server = new EventEmitter() as MockServer;
  server.on = jest.fn((event: string, handler: (...args: any[]) => void) => {
    return EventEmitter.prototype.on.call(server, event, handler);
  });
  return server;
};

// Create mock app factory
const createMockApp = (server: MockServer): MockApp => ({
  use: jest.fn(),
  post: jest.fn(),
  listen: jest.fn((port: number, cb?: () => void) => {
    if (cb) cb();
    return server;
  }),
});

// Create mock express factory
const createMockExpress = (): MockExpress => {
  const mockServer = createMockServer();
  const mockApp = createMockApp(mockServer);
  
  const mockExpress = jest.fn(() => mockApp) as unknown as MockExpress;
  mockExpress.json = jest.fn();
  
  return mockExpress;
};

export default createMockExpress(); 