import { format } from "date-fns";
import { formatNumber } from "@/lib/utils";
import { numberToWords } from "@/utils/numberToWords";
import { parsePaymentInfo } from "@/components/hooks/useBusinessSettings";

// Helpers
function padRight(text: string, width: number) {
  text = text || "";
  return text.length >= width ? text.slice(0, width) : text + " ".repeat(width - text.length);
}

function padLeft(text: string, width: number) {
  text = text || "";
  return text.length >= width ? text.slice(0, width) : " ".repeat(width - text.length) + text;
}

function centerText(text: string, width: number = 32) {
  text = text || "";
  if (text.length >= width) return text.slice(0, width);
  const padding = Math.floor((width - text.length) / 2);
  return " ".repeat(padding) + text;
}

export function generateThermalText(sale: any, settings: any, currency?: string) {
  const displayCurrency = currency || settings.currency || '';
  const line = "-".repeat(32);
  const doubleLine = "=".repeat(32); 
  let text = "";

  // ===== Business Header =====\
  text += doubleLine + "\n"; 
  if (settings.businessName) text += centerText(settings.businessName.toUpperCase()) + "\n";
  if (settings.businessAddress) text += centerText(settings.businessAddress) + "\n";
  if (settings.businessPhone) text += centerText(`Tel: ${settings.businessPhone}`) + "\n";
  if (settings.businessEmail) text += centerText(settings.businessEmail) + "\n";
  text += doubleLine + "\n"; 

  // ===== Document Title =====
  const titleMap: Record<string, string> = {
    "Quote": "QUOTATION",
    "Paid": "SALES RECEIPT",
    "Installment Sale": "INSTALLMENT SALE",
    "NOT PAID": "INVOICE",
  };
  const docTitle = titleMap[sale.paymentStatus] || "INVOICE";
  text += centerText(docTitle) + "\n";
  text += line + "\n";

  // ===== Receipt Info =====
  text += padRight("Receipt #:", 15) + padLeft(sale.receiptNumber || '', 17) + "\n";
  text += padRight("Date:", 15) + padLeft(format(new Date(sale.date || Date.now()), "dd/MM/yyyy HH:mm"), 17) + "\n";
  text += padRight("Status:", 15) + padLeft(sale.paymentStatus || '', 17) + "\n";
  text += line + "\n";

  // ===== Customer Info =====
  text += padRight("Customer:", 15) + padLeft(sale.customerName || '', 17) + "\n";
  if (sale.customerAddress) text += padRight("Address:", 15) + padLeft(sale.customerAddress, 17) + "\n";
  if (sale.customerContact) text += padRight("Contact:", 15) + padLeft(sale.customerContact, 17) + "\n";
  text += line + "\n";

  // ===== Items =====
  text += padRight("Item", 16) + padLeft("Qty", 6) + padLeft("Total (" + displayCurrency + ")", 10) + "\n";
  text += "-".repeat(32) + "\n";

  let subtotalBeforeDiscount = 0;
  let totalDiscountAmount = 0;

  Array.isArray(sale.items) && sale.items.forEach((item: any) => {
    const quantity = item.quantity || 0;
    const price = item.price || 0;
    const subtotal = quantity * price;
    const discount = item.discountAmount ?? ((subtotal * (item.discountPercentage || 0)) / 100);
    const total = subtotal - discount;

    subtotalBeforeDiscount += subtotal;
    totalDiscountAmount += discount;

    text += padRight(item.description || '', 16) + padLeft(String(quantity), 6) + padLeft(formatNumber(total), 10) + "\n";
    if (discount > 0) {
      const discText = item.discountType === "amount" ? "" : `(${item.discountPercentage || 0}%)`;
      text += padRight(`Discount ${discText}`, 16) + padLeft("", 6) + padLeft(`-${formatNumber(discount)}`, 10) + "\n";
    }
  });

  text += line + "\n";

  // ===== Totals =====
  const subtotalAfterDiscount = subtotalBeforeDiscount - totalDiscountAmount;
  const taxRate = sale.taxRate || 0;
  const taxAmount = subtotalAfterDiscount * (taxRate / 100);
  const totalAmount = subtotalAfterDiscount + taxAmount;
  const amountPaid = sale.amountPaid || 0;
  const amountDue = sale.amountDue || Math.max(0, totalAmount - amountPaid);

  text += padRight("Subtotal:", 22) + padLeft(formatNumber(subtotalBeforeDiscount), 10) + "\n";
  if (totalDiscountAmount > 0) text += padRight("Total Discount:", 22) + padLeft(`-${formatNumber(totalDiscountAmount)}`, 10) + "\n";
  if (taxRate > 0) text += padRight(`Tax (${taxRate}%):`, 22) + padLeft(formatNumber(taxAmount), 10) + "\n";
  text += padRight("TOTAL (" + displayCurrency + "):", 22) + padLeft(formatNumber(totalAmount), 10) + "\n";

  if (sale.paymentStatus === "Installment Sale") {
    text += padRight("Amount Paid:", 22) + padLeft(formatNumber(amountPaid), 10) + "\n";
    text += padRight("Amount Due:", 22) + padLeft(formatNumber(amountDue), 10) + "\n";
  }

  // ===== Amount in Words =====
  text += `Amount in words:\n${numberToWords(totalAmount)} only\n`;
  text += line + "\n";

  // ===== Notes =====
  if (sale.notes) {
    text += "Notes:\n" + sale.notes + "\n" + line + "\n";
  }

  // ===== Payment Info (Side by Side) =====
  const paymentMethods = settings.paymentInfo ? parsePaymentInfo(settings.paymentInfo) : [];
  if (Array.isArray(paymentMethods) && paymentMethods.length > 0) {
    paymentMethods.forEach((p: any) => {
      if (p.method || p.accountNumber || p.accountName) {
        // Method centered
        text += centerText(p.method || '') + "\n";

        // Account number left/right
        text += padRight("Acc:", 8) + padLeft(p.accountNumber || '', 24) + "\n";

        // Account name left/right
        text += padRight("Name:", 8) + padLeft(p.accountName || '', 24) + "\n";

        text += line + "\n"; // optional separator between methods
      }
    });
  }


  // ===== Signature =====
  if (settings.signature) {
    text += centerText("Authorized Signature") + "\n";
    text += centerText("___________________________") + "\n";
    text += line + "\n";
  }

  // ===== Footer =====
  text += centerText("Thank you for your business!") + "\n";
  text += centerText("Created by Gonza Systems") + "\n";
  text += doubleLine + "\n"; 

  return text;
}
