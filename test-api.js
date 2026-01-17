/**
 * Simple test script for the generate-trip-suggestions API
 * 
 * Usage:
 *   1. Make sure your dev server is running: npm run dev
 *   2. Get a trip_id (UUID) or invite_code from your trip
 *   3. Run: node test-api.js <trip_id_or_invite_code>
 * 
 * Examples:
 *   node test-api.js abc123-def456-ghi789  (trip ID - UUID)
 *   node test-api.js 02TRCU                (invite code - 6 chars)
 * 
 * How to find your trip ID:
 *   - Go to your trip page: http://localhost:3000/trips/[trip-id]
 *   - Copy the UUID from the URL
 *   - OR use an invite code (the script will look it up)
 */

const input = process.argv[2];

if (!input) {
  console.error('Usage: node test-api.js <trip_id_or_invite_code>');
  console.error('\nExamples:');
  console.error('  node test-api.js abc123-def456-ghi789  (trip ID)');
  console.error('  node test-api.js 02TRCU                (invite code)');
  console.error('\n💡 Tip: Get trip ID from the URL when viewing a trip: /trips/[trip-id]');
  process.exit(1);
}

// Check if it's a UUID (trip ID) or short code (invite code)
const isUUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(input);
const isInviteCode = input.length <= 10 && /^[A-Z0-9]+$/.test(input.toUpperCase());

async function findTripIdByInviteCode(inviteCode) {
  try {
    // First try to find via the join endpoint logic (if it exists)
    // Otherwise, we'll need to query Supabase directly
    console.log(`🔍 Looking up trip ID for invite code: ${inviteCode}`);
    
    // Since we can't access Supabase directly from Node without env vars,
    // let's try a simple API endpoint or guide the user
    console.log('   Note: To find trip ID by invite code, either:');
    console.log('   1. Check Supabase dashboard > trips table');
    console.log('   2. Or visit the trip page URL in your browser');
    console.log('   3. Or use a trip ID directly (UUID format)\n');
    
    return null;
  } catch (error) {
    console.error('   Error looking up trip:', error.message);
    return null;
  }
}

async function testAPI(tripId) {
  try {
    console.log(`\n🧪 Testing API with trip_id: ${tripId}\n`);
    
    const response = await fetch('http://localhost:3000/api/generate-trip-suggestions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ trip_id: tripId }),
    });

    // Check if response is JSON or HTML (error page)
    const contentType = response.headers.get('content-type') || '';
    let data;
    
    if (contentType.includes('application/json')) {
      data = await response.json();
    } else {
      // Likely an HTML error page - show what we got
      const text = await response.text();
      console.error('❌ Server returned HTML instead of JSON:');
      console.error(`   Status: ${response.status} ${response.statusText}`);
      console.error(`   Content-Type: ${contentType}`);
      console.error(`   Response preview (first 500 chars):\n${text.substring(0, 500)}`);
      console.error('\n💡 Troubleshooting:');
      console.error('   - Make sure your dev server is running: npm run dev');
      console.error('   - Check the terminal where the dev server is running for errors');
      console.error('   - Verify the API route exists and has no syntax errors');
      console.error('   - Check that GEMINI_API_KEY is set in .env.local');
      return;
    }

    if (!response.ok) {
      console.error('❌ API Error:', response.status, response.statusText);
      console.error('Response:', JSON.stringify(data, null, 2));
      
      if (response.status === 404 && data.error === 'Trip not found') {
        console.error('\n💡 Troubleshooting:');
        console.error('   - Make sure the trip_id is correct (UUID format)');
        console.error('   - Check that the trip exists in your Supabase trips table');
        console.error('   - Get the trip ID from the URL when viewing a trip page');
      }
      return;
    }

    console.log('✅ API Response:', response.status);
    console.log('\n📊 Suggestions Summary:');
    console.log(`  ✈️  Flights: ${data.suggestions?.flights?.length || 0}`);
    console.log(`  🏨 Accommodations: ${data.suggestions?.accommodations?.length || 0}`);
    console.log(`  🎯 Activities: ${data.suggestions?.activities?.length || 0}`);
    
    console.log('\n📋 Full Response:');
    console.log(JSON.stringify(data, null, 2));
  } catch (error) {
    console.error('❌ Test failed:', error.message);
    if (error.code === 'ECONNREFUSED') {
      console.error('   Make sure your dev server is running: npm run dev');
    }
  }
}

async function main() {
  if (isUUID) {
    // It's already a trip ID (UUID)
    await testAPI(input);
  } else if (isInviteCode) {
    // It's an invite code - try to find the trip ID
    const tripId = await findTripIdByInviteCode(input.toUpperCase());
    if (tripId) {
      await testAPI(tripId);
    } else {
      console.error('\n❌ Could not find trip ID for invite code:', input);
      console.error('\n💡 To get the trip ID:');
      console.error('   1. Open your trip in the browser');
      console.error('   2. Check the URL: http://localhost:3000/trips/[trip-id]');
      console.error('   3. Copy the UUID from the URL');
      console.error('   4. Run: node test-api.js <that-uuid>\n');
    }
  } else {
    console.error('❌ Invalid input. Expected either:');
    console.error('   - Trip ID (UUID format): abc123-def456-ghi789-...');
    console.error('   - Invite code (6 chars): 02TRCU');
    console.error('\n💡 Get trip ID from URL when viewing a trip: /trips/[trip-id]');
  }
}

main();
