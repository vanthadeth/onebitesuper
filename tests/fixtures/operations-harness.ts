// Test-only entry. No production app imports this fixture or publishes a debug API.
import * as core from '../../packages/core/src/operations';
import * as storage from '../../packages/offline/src/operations';
(globalThis as unknown as {operationFoundation:typeof core&typeof storage}).operationFoundation={...core,...storage};
