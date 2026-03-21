/**
 * ローカルの blooming_products.json を Firestore に移行するスクリプト
 * 使い方: node scripts/migrate-products.js
 */
const admin = require('../functions/node_modules/firebase-admin')
const fs = require('fs')
const path = require('path')

// Firebase Admin SDK 初期化（ローカルの認証情報を使用）
admin.initializeApp({ projectId: 'park-mobility-pressman' })
const db = admin.firestore()

async function migrate() {
  const dataPath = path.join(__dirname, '..', 'server', 'data', 'blooming_products.json')
  const products = JSON.parse(fs.readFileSync(dataPath, 'utf-8'))
  console.log(`${products.length} 件の商品を Firestore に投入します...`)

  // Firestore batch は 500件/バッチまで
  const BATCH_SIZE = 450
  let count = 0

  for (let i = 0; i < products.length; i += BATCH_SIZE) {
    const batch = db.batch()
    const chunk = products.slice(i, i + BATCH_SIZE)

    for (const product of chunk) {
      const { id, ...data } = product
      // 元のIDをドキュメントIDとして使用
      const ref = db.collection('blooming_products').doc(id)
      batch.set(ref, data)
    }

    await batch.commit()
    count += chunk.length
    console.log(`  ${count} / ${products.length} 件完了`)
  }

  console.log('移行完了!')
}

migrate().catch((err) => {
  console.error('移行失敗:', err)
  process.exit(1)
})
