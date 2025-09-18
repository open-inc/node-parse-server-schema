#!/usr/bin/env node

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const projectRoot = path.resolve(__dirname, '..');

console.log('📁 Copying Handlebars templates to dist folder...');

const srcTemplatesDir = path.join(projectRoot, 'src', 'features', 'schema', 'templates');
const distTemplatesDir = path.join(projectRoot, 'dist', 'features', 'schema', 'templates');

try {
    // Ensure destination directory exists
    fs.mkdirSync(distTemplatesDir, { recursive: true });

    // Read all files in the templates directory
    const templateFiles = fs.readdirSync(srcTemplatesDir).filter(file => file.endsWith('.hbs'));

    if (templateFiles.length === 0) {
        console.log('⚠️  No .hbs template files found in source directory');
        process.exit(0);
    }

    // Copy each template file
    let copiedCount = 0;
    for (const file of templateFiles) {
        const srcPath = path.join(srcTemplatesDir, file);
        const distPath = path.join(distTemplatesDir, file);

        fs.copyFileSync(srcPath, distPath);
        console.log(`   ✅ Copied ${file}`);
        copiedCount++;
    }

    console.log(`📋 Successfully copied ${copiedCount} Handlebars template(s) to dist folder`);
} catch (error) {
    console.error('❌ Error copying templates:', error.message);
    process.exit(1);
}