import { Capacitor } from '@capacitor/core';

export async function print(data: string) {
  const platform = Capacitor.getPlatform();

  if (platform === 'web') {
    const { printWeb } = await import('./thermalPrinterWeb');
    return await printWeb(data);
  } else {
    const { printBluetooth } = await import('./thermalPrinterNative');
    return await printBluetooth(data);
  }
}
