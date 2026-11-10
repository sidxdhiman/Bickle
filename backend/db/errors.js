// Error shims that preserve the mongoose error contract the controllers
// already branch on — without mongoose:
//
//   error.name === 'ValidationError'   (art/note/whiteboard create+update)
//   error.code === 11000               (money/note duplicate key)
//   error.kind === 'ObjectId'          (habit malformed-id paths)
//
// translateError() converts better-sqlite3 constraint failures into these
// shapes at the helper layer, so controller code stays untouched.

class ValidationError extends Error {
  constructor(message) {
    super(message);
    this.name = 'ValidationError';
  }
}

class DuplicateError extends Error {
  constructor(message) {
    super(message);
    this.name = 'MongoServerError';
    this.code = 11000;
  }
}

class CastError extends Error {
  constructor(message) {
    super(message);
    this.name = 'CastError';
    this.kind = 'ObjectId';
  }
}

function translateError(error) {
  if (error && typeof error.code === 'string' && error.code.startsWith('SQLITE_CONSTRAINT')) {
    if (error.code === 'SQLITE_CONSTRAINT_UNIQUE' || error.code === 'SQLITE_CONSTRAINT_PRIMARYKEY') {
      return new DuplicateError(error.message);
    }
    return new ValidationError(error.message);
  }
  return error;
}

module.exports = { ValidationError, DuplicateError, CastError, translateError };
