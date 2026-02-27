/// <reference types="vite/client" />

declare const Aioli: {
  new (tools: string[]): Promise<AioliInstance>
}

interface AioliInstance {
  mount(files: { name: string; data: string | Uint8Array }[]): Promise<void>
  exec(cmd: string): Promise<string>
}
