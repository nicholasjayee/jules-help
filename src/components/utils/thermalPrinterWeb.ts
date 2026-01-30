let selectedPort: SerialPort | null = null;

export async function printWeb(data: string): Promise<{ success: boolean; message: string }> {
  if (!('serial' in navigator)) {
    return { success: false, message: 'Web Serial API not supported.' };
  }

  try {
    const ports: SerialPort[] = await (navigator as any).serial.getPorts();
    const port = ports.length ? ports[0] : await (navigator as any).serial.requestPort();
    if (!port.readable || !port.writable) await port.open({ baudRate: 9600 });

    const writer = port.writable.getWriter();
    const encoder = new TextEncoder();
    await writer.write(encoder.encode(data + '\n\n\n'));
    writer.releaseLock();

    selectedPort = port;
    return { success: true, message: 'Web print sent successfully.' };
  } catch (err: any) {
    return { success: false, message: `Web print failed: ${err?.message || err}` };
  }
}
