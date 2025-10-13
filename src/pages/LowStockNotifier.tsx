import React, { useState, useEffect } from 'react';
import { getItems } from '../api';
import { useToast } from '@/hooks/use-toast';
import { Button } from '@/components/ui/button'; // Import from Shadcn/UI or adjust based on your setup

// Interface for item type (for TypeScript safety)
interface Item {
  id: number;
  name: string;
  quantity: number;
  low_stock_threshold: number | null;
  // Add other fields as needed
}

/**
 * LowStockNotifier Component
 * Independently monitors and alerts for low stock items
 */
const LowStockNotifier: React.FC = () => {
  const { toast } = useToast();
  const [lastItems, setLastItems] = useState<{ [id: string]: number }>({});

  useEffect(() => {
    const checkLowStock = async () => {
      try {
        const items = await getItems();
        const lowStock = items.filter(item => item.quantity <= (item.low_stock_threshold || 0)); // Handle null threshold
        const newLowStock = lowStock.filter(item => !lastItems[item.id] || lastItems[item.id] > item.quantity);

        if (newLowStock.length > 0) {
          toast({
            title: "Low Stock Alert!",
            description: (
              <div className="space-y-2">
                {newLowStock.map(item => (
                  <div key={item.id} className="flex items-center justify-between">
                    <span>{item.name}: {item.quantity} (Threshold: {item.low_stock_threshold || 0})</span>
                    <span className={item.quantity === 0 ? 'text-red-600' : 'text-yellow-600'}>
                      {item.quantity === 0 ? 'OUT!' : 'LOW'}
                    </span>
                  </div>
                ))}
                <Button onClick={() => toast.dismiss()} className="mt-2 bg-blue-500 text-white hover:bg-blue-600">OK</Button>
              </div>
            ),
            variant: "destructive",
            duration: 10000,
          });
        }

        setLastItems(items.reduce((acc, item) => ({ ...acc, [item.id]: item.quantity }), {}));
      } catch (error) {
        console.error('Error checking low stock:', error);
      }
    };

    checkLowStock(); // Initial check
    const interval = setInterval(checkLowStock, 10000); // Check every 10 seconds
    return () => clearInterval(interval);
  }, [lastItems]);

  return null; // No UI, runs in background
};

export default LowStockNotifier;