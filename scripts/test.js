console.log('Test script running...');
try {
    const { Pool } = require('pg');
    console.log('pg required successfully');
    require('dotenv').config();
    console.log('dotenv required successfully');
} catch (e) {
    console.error('Require failed:', e);
}
console.log('Test script finished');
