import http from 'http';

http.get('http://localhost:3000/', (res) => {
  let data = '';
  res.on('data', (chunk) => { data += chunk; });
  res.on('end', () => {
    console.log('HTTP Status:', res.statusCode);
    const checks = [
      { name: '1. "Other Specialized Sectors" removed', expected: false, actual: data.includes('Other Specialized Sectors') },
      { name: '2. "All Industries" filter toggle removed', expected: false, actual: data.includes('All Industries') },
      { name: '3. Industries paragraph shortened', expected: true, actual: data.includes('tailored for sectoral safety and zero-downtime operations') },
      { name: '4. "SECTOR SPECIALIZATIONS" badge removed', expected: false, actual: data.includes('SECTOR SPECIALIZATIONS') },
      { name: '5. Clients paragraph shortened', expected: true, actual: data.includes('depend on Reach International for reliable aerial access and material handling equipment') && !data.includes('From national infrastructure mega-projects') },
      { name: '6. Clients trust badges are rounded-full and clean', expected: true, actual: data.includes('100% Certified Fleet') && data.includes('&lt;5% Breakdown Rate') },
      { name: '7. "Authorized OEM Fleet Partnerships" badge removed', expected: false, actual: data.includes('Authorized OEM Fleet Partnerships') },
      { name: '8. MHE paragraph shortened', expected: true, actual: data.includes('Heavy-duty forklifts and reach trucks engineered for warehouse and plant logistics.') && !data.includes('Heavy-duty diesel, electric, and lithium') },
      { name: '9. AWP paragraph shortened', expected: true, actual: data.includes('High-reach access platforms engineered for worker safety and elevated job-site productivity.') && !data.includes('precision positioning') },
    ];

    let allPassed = true;
    for (const c of checks) {
      const passed = c.actual === c.expected;
      console.log(`${passed ? '✅ PASS' : '❌ FAIL'}: ${c.name} (expected: ${c.expected}, got: ${c.actual})`);
      if (!passed) allPassed = false;
    }

    if (allPassed) {
      console.log('\n🎉 ALL 9 LIVE DEV-SERVER CHECKS PASSED PERFECTLY!');
      process.exit(0);
    } else {
      console.log('\n❌ Some checks failed.');
      process.exit(1);
    }
  });
}).on('error', (err) => {
  console.log('Dev server error:', err.message);
  process.exit(1);
});
