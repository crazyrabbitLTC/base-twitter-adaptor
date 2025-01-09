interface LogMethod {
  (message: string, ...meta: any[]): void;
  (info: object): void;
}

interface MockLogger {
  info: jest.Mock;
  error: jest.Mock;
  warn: jest.Mock;
  debug: jest.Mock;
  log: jest.Mock;
}

interface MockWinston {
  createLogger: jest.Mock;
  format: {
    combine: jest.Mock;
    timestamp: jest.Mock;
    printf: jest.Mock;
    colorize: jest.Mock;
  };
  transports: {
    Console: jest.Mock;
  };
}

// Create mock logger factory
const createMockLogger = (): MockLogger => ({
  info: jest.fn(),
  error: jest.fn(),
  warn: jest.fn(),
  debug: jest.fn(),
  log: jest.fn(),
});

// Create mock winston instance
const mockWinston: MockWinston = {
  createLogger: jest.fn().mockReturnValue(createMockLogger()),
  format: {
    combine: jest.fn(),
    timestamp: jest.fn(),
    printf: jest.fn(),
    colorize: jest.fn(),
  },
  transports: {
    Console: jest.fn(),
  },
};

export = mockWinston;
