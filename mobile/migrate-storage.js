const { createClient } = require('@supabase/supabase-js');

// OLD PROJECT
const OLD_URL = 'https://ydcbycanrbdcyyabnfxn.supabase.co';
const OLD_SERVICE_KEY = process.env.SUPABASE_OLD_SERVICE_KEY;

// NEW PROJECT
const NEW_URL = 'https://zmsactoninhdtngtlyep.supabase.co';
const NEW_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

const oldSupabase = createClient(OLD_URL, OLD_SERVICE_KEY);
const newSupabase = createClient(NEW_URL, NEW_SERVICE_KEY);

const BUCKETS = ['restaurant-assets', 'driver-documents'];

async function migrate() {
  console.log('🚀 Starting Storage Migration...');

  for (const bucket of BUCKETS) {
    console.log(`\n📂 Migrating bucket: ${bucket}`);

    // Create bucket in new project just in case
    const { error: bucketError } = await newSupabase.storage.createBucket(bucket, {
      public: true,
    });
    if (bucketError && bucketError.message !== 'Bucket already exists') {
      console.error(`   ❌ Failed to create bucket ${bucket}:`, bucketError.message);
    } else {
      console.log(`   ✅ Bucket ${bucket} is ready.`);
    }

    // List all files in bucket
    const { data: files, error: listError } = await oldSupabase.storage.from(bucket).list('', {
      limit: 1000,
    });

    if (listError) {
      console.error(`   ❌ Failed to list files in ${bucket}:`, listError.message);
      continue;
    }

    console.log(`   📝 Found ${files.length} items to transfer.`);

    for (const file of files) {
      if (file.name === '.emptyFolderPlaceholder') continue;

      // Handle folders vs files
      // NOTE: list() is shallow. If there are subfolders, we need recursive migration.
      // Based on URLs, there are subfolders like 'menu/' and GUID folders.
      
      await migrateItem(bucket, '', file);
    }
  }

  console.log('\n🏁 Migration Complete!');
}

async function migrateItem(bucket, path, item) {
  const fullPath = path ? `${path}/${item.name}` : item.name;

  if (!item.id) {
    // It's a folder (assuming based on list results)
    const { data: subItems, error } = await oldSupabase.storage.from(bucket).list(fullPath);
    if (error) {
      console.error(`   ❌ Error listing subfolder ${fullPath}:`, error.message);
      return;
    }
    for (const subItem of subItems) {
      await migrateItem(bucket, fullPath, subItem);
    }
  } else {
    // It's a file
    console.log(`   ⬆️ Transferring: ${fullPath}...`);

    // Download
    const { data: blob, error: downloadError } = await oldSupabase.storage.from(bucket).download(fullPath);
    if (downloadError) {
      console.error(`   ❌ Download error [${fullPath}]:`, downloadError.message);
      return;
    }

    // Upload
    const { error: uploadError } = await newSupabase.storage.from(bucket).upload(fullPath, blob, {
      upsert: true,
      contentType: item.metadata?.mimetype
    });

    if (uploadError) {
      console.error(`   ❌ Upload error [${fullPath}]:`, uploadError.message);
    } else {
      console.log(`   ✅ Success: ${fullPath}`);
    }
  }
}

migrate();
