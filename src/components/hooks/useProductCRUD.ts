
import { Product, DbProduct, mapDbProductToProduct } from '@/types';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { useStockHistory } from '@/hooks/useStockHistory';
import { useBusiness } from '@/contexts/BusinessContext';
import { useActivityLogger } from '@/hooks/useActivityLogger';

/**
 * Hook for Create, Read, Update, Delete operations on products
 */
export const useProductCRUD = (
  userId: string | undefined,
  products: Product[],
  setProducts: React.Dispatch<React.SetStateAction<Product[]>>,
  applyFilters: (products: Product[], filters: any) => Product[]
) => {
  const { toast } = useToast();
  const { createStockHistoryEntry } = useStockHistory(userId);
  const { currentBusiness } = useBusiness();
  const { logActivity } = useActivityLogger();

  const createProduct = async (productData: Partial<Product> & { createdAt?: Date }) => {
    try {
      if (!userId || !currentBusiness) {
        toast({
          title: "Error",
          description: "You must be logged in and have a business selected to create products",
          variant: "destructive"
        });
        return null;
      }

      console.log('useProductCRUD - Creating product with data:', productData);
      console.log('useProductCRUD - Received quantity:', productData.quantity, 'Type:', typeof productData.quantity);

      // Get the next item number for this location
      const { data: itemNumberData, error: itemNumberError } = await (supabase as any)
        .rpc('get_next_item_number', { location_uuid: currentBusiness.id });

      if (itemNumberError) {
        console.error('Error generating item number:', itemNumberError);
        toast({
          title: "Error",
          description: "Failed to generate item number. Please try again.",
          variant: "destructive"
        });
        return null;
      }

      // Ensure quantity is properly handled - use the exact value from form data
      const quantity = typeof productData.quantity === 'number' ? productData.quantity : 0;
      console.log('useProductCRUD - Final quantity to save:', quantity);

      // Ensure all required fields are defined with defaults when not provided
      const dbProduct = {
        user_id: userId,
        location_id: currentBusiness.id,
        item_number: itemNumberData, // Use the generated item number
        name: productData.name || "Unnamed Product",
        description: productData.description || "",
        category: productData.category || "", // Allow empty category
        quantity: quantity,
        cost_price: productData.costPrice !== undefined ? productData.costPrice : 0,
        selling_price: productData.sellingPrice !== undefined ? productData.sellingPrice : 0,
        supplier: productData.supplier || "",
        image_url: productData.imageUrl || null,
        minimum_stock: productData.minimumStock !== undefined ? productData.minimumStock : 0,
        created_at: productData.createdAt ? productData.createdAt.toISOString() : new Date().toISOString()
      };

      console.log('useProductCRUD - Database product data:', dbProduct);
      console.log('useProductCRUD - Database quantity field:', dbProduct.quantity);

      const { data, error } = await supabase
        .from('products')
        .insert(dbProduct)
        .select()
        .single();

      if (error) {
        console.error('Database insertion error:', error);
        throw error;
      }

      if (data) {
        const newProduct = mapDbProductToProduct(data as DbProduct);
        const updatedProducts = [...products, newProduct];
        setProducts(updatedProducts);

        console.log('useProductCRUD - Product created successfully with quantity:', newProduct.quantity);

        // Create stock history entry for initial stock
        if (quantity > 0) {
          console.log('useProductCRUD - Creating stock history entry for initial stock:', quantity);
          await createStockHistoryEntry(data.id, 0, quantity, "Initial stock", undefined, undefined, undefined, dbProduct.name);
        }

        // Log activity
        await logActivity({
          activityType: 'CREATE',
          module: 'INVENTORY',
          entityType: 'product',
          entityId: newProduct.id,
          entityName: newProduct.name,
          description: `Created product "${newProduct.name}" with quantity: ${quantity}`,
          metadata: {
            itemNumber: newProduct.itemNumber,
            category: newProduct.category,
            costPrice: newProduct.costPrice,
            sellingPrice: newProduct.sellingPrice,
            quantity: quantity
          }
        });

        return newProduct;
      }

      return null;
    } catch (error) {
      console.error('Error creating product:', error);
      toast({
        title: "Error",
        description: "Failed to create product. Please try again.",
        variant: "destructive"
      });
      return null;
    }
  };

  const updateProduct = async (
    productId: string,
    productData: Partial<Product> & { createdAt?: Date },
    referenceId?: string,
    isFromSale = false,
    customChangeReason?: string
  ) => {
    try {
      if (!userId || !currentBusiness) return false;

      // Get current product for stock history if quantity is changing
      let currentProduct: Product | null = null;
      if (productData.quantity !== undefined) {
        const { data: currentData } = await supabase
          .from('products')
          .select('*')
          .eq('id', productId)
          .single();

        if (currentData) {
          currentProduct = mapDbProductToProduct(currentData as DbProduct);
        }
      }

      // Prepare data for update (excluding item_number as it's auto-generated and shouldn't be updated)
      const updateData: { [key: string]: any } = {};
      if (productData.name !== undefined) updateData.name = productData.name;
      if (productData.description !== undefined) updateData.description = productData.description;
      if (productData.category !== undefined) updateData.category = productData.category || ''; // Allow empty category
      if (productData.quantity !== undefined) updateData.quantity = productData.quantity; // Allow negative quantities
      if (productData.costPrice !== undefined) updateData.cost_price = productData.costPrice;
      if (productData.sellingPrice !== undefined) updateData.selling_price = productData.sellingPrice;
      if (productData.supplier !== undefined) updateData.supplier = productData.supplier;
      if (productData.imageUrl !== undefined) updateData.image_url = productData.imageUrl;
      if (productData.minimumStock !== undefined) updateData.minimum_stock = productData.minimumStock;
      if (productData.createdAt !== undefined) updateData.created_at = productData.createdAt.toISOString();

      // Ensure updated_at is set
      updateData.updated_at = new Date().toISOString();

      const { data, error } = await supabase
        .from('products')
        .update(updateData)
        .eq('id', productId)
        .select()
        .single();

      if (error) throw error;

      if (data) {
        const updatedProduct = mapDbProductToProduct(data as DbProduct);

        // Update local state
        const updatedProducts = products.map(p => p.id === productId ? updatedProduct : p);
        setProducts(updatedProducts);

        // Create stock history entry if quantity changed and not skipping history
        if (productData.quantity !== undefined && currentProduct && customChangeReason !== 'skip-history') {
          // Use custom change reason if provided, otherwise determine reason based on context
          let changeReason = "";

          if (customChangeReason) {
            changeReason = customChangeReason;
          } else if (isFromSale && productData.quantity < currentProduct.quantity) {
            changeReason = "Sale";
          } else if (currentProduct.quantity === 0 && productData.quantity > 0) {
            // First time adding stock to a product that had 0 stock - this is initial stock
            changeReason = "Initial stock";
          } else if (productData.quantity > currentProduct.quantity) {
            changeReason = "Manual stock addition";
          } else {
            changeReason = "Manual stock reduction";
          }

          await createStockHistoryEntry(
            productId,
            currentProduct.quantity,
            productData.quantity,
            changeReason,
            referenceId,
            undefined,
            undefined,
            currentProduct.name
          );
        }

        // Log activity for product update
        await logActivity({
          activityType: 'UPDATE',
          module: 'INVENTORY',
          entityType: 'product',
          entityId: productId,
          entityName: updatedProduct.name,
          description: `Updated product "${updatedProduct.name}"${currentProduct && productData.quantity !== undefined ? ` - Stock changed from ${currentProduct.quantity} to ${productData.quantity}` : ''}`,
          metadata: {
            changes: updateData,
            previousQuantity: currentProduct?.quantity,
            newQuantity: productData.quantity
          }
        });

        return true;
      }

      return false;
    } catch (error) {
      console.error('Error updating product:', error);
      toast({
        title: "Error",
        description: "Failed to update product. Please try again.",
        variant: "destructive"
      });
      return false;
    }
  };

  const deleteProduct = async (productId: string) => {
    try {
      if (!userId) return false;

      // Get product details before deletion for logging
      const productToDelete = products.find(p => p.id === productId);

      const { error } = await supabase
        .from('products')
        .delete()
        .eq('id', productId);

      if (error) throw error;

      // Update local state
      const updatedProducts = products.filter(p => p.id !== productId);
      setProducts(updatedProducts);

      // Log activity
      if (productToDelete) {
        await logActivity({
          activityType: 'DELETE',
          module: 'INVENTORY',
          entityType: 'product',
          entityId: productId,
          entityName: productToDelete.name,
          description: `Deleted product "${productToDelete.name}"`,
          metadata: {
            itemNumber: productToDelete.itemNumber,
            category: productToDelete.category,
            lastQuantity: productToDelete.quantity
          }
        });
      }

      return true;
    } catch (error) {
      console.error('Error deleting product:', error);
      toast({
        title: "Error",
        description: "Failed to delete product. Please try again.",
        variant: "destructive"
      });
      return false;
    }
  };

  return {
    createProduct,
    updateProduct,
    deleteProduct
  };
};
