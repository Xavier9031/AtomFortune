declare module 'atomfortune-api' {
  export function startServer(port: number, migrationsFolder: string): Promise<any>
  export const app: any
}

declare module 'qrcode' {
  interface QRCodeOptions {
    width?: number
    margin?: number
    color?: { dark?: string; light?: string }
  }
  export function toDataURL(text: string, options?: QRCodeOptions): Promise<string>
}
