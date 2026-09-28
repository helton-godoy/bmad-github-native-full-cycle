describe('Server Entrypoint (src/index.js)', () => {
  let mockServer;
  let http;
  let logger;
  const originalEnv = process.env;

  beforeEach(() => {
    jest.resetModules();
    process.env = { ...originalEnv };

    mockServer = {
      listen: jest.fn((port, callback) => {
        if (typeof callback === 'function') {
          callback();
        }
        return mockServer;
      })
    };

    jest.doMock('http', () => ({
      createServer: jest.fn(() => mockServer)
    }));

    jest.doMock('../../src/app', () => ({}));

    jest.doMock('../../src/utils/logger', () => ({
      info: jest.fn(),
      error: jest.fn(),
      warn: jest.fn(),
      debug: jest.fn()
    }));

    http = require('http');
    logger = require('../../src/utils/logger');
  });

  afterEach(() => {
    process.env = originalEnv;
    jest.clearAllMocks();
  });

  test('should create http server with app and listen on default port 3000', () => {
    delete process.env.PORT;

    const app = require('../../src/app');
    require('../../src/index');

    expect(http.createServer).toHaveBeenCalledWith(app);
    expect(mockServer.listen).toHaveBeenCalledWith(3000, expect.any(Function));
    expect(logger.info).toHaveBeenCalledWith('🚀 Server running on http://localhost:3000');
  });

  test('should use process.env.PORT when defined', () => {
    process.env.PORT = '8080';

    const app = require('../../src/app');
    require('../../src/index');

    expect(http.createServer).toHaveBeenCalledWith(app);
    expect(mockServer.listen).toHaveBeenCalledWith('8080', expect.any(Function));
    expect(logger.info).toHaveBeenCalledWith('🚀 Server running on http://localhost:8080');
  });
});
