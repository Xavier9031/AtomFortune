declare module 'atomfortune-api' {
  export function startServer(port: number, migrationsFolder: string): Promise<void>
}
