/**
 * Node.js Execution Runner for Phase 31 Automated Test Suite
 */
import { runAllAutomatedTests } from './lib/testing-suite.ts';

console.log('[Test Runner]: Initializing Phase 31 Automated Test Suite...');
runAllAutomatedTests()
  .then(({ total, passed, failed }) => {
    if (failed > 0) {
      console.error(`❌ Test Suite Failed: ${failed} failed test(s).`);
      process.exit(1);
    }
    console.log(`✅ Test Suite Passed: All ${passed}/${total} test scenarios verified!`);
    process.exit(0);
  })
  .catch((err) => {
    console.error('Fatal execution error:', err);
    process.exit(1);
  });
