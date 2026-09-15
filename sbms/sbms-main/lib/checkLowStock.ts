import { connectDB } from '@/lib/mongodb'
import Product from '@/lib/models/Product'
import Alert from '@/lib/models/Alert'

export async function checkLowStock(): Promise<void> {
  await connectDB()

  const lowStockProducts = await Product.find({
    isActive: true,
    $expr: { $lte: ['$stockQuantity', '$reorderThreshold'] }
  })

  for (const product of lowStockProducts) {
    const existingAlert = await Alert.findOne({
      alertType: 'LOW_STOCK',
      'triggerData.productId': product._id,
      acknowledgedAt: null
    })

    if (!existingAlert) {
      await Alert.create({
        alertType: 'LOW_STOCK',
        severity: product.stockQuantity === 0 ? 'critical' : 'warning',
        message: `Low stock for ${product.name} (${product.stockQuantity} remaining)`,
        triggerData: {
          productId: product._id,
          currentStock: product.stockQuantity,
          reorderThreshold: product.reorderThreshold
        },
        channel: 'in-app'
      })
    }
  }
}
