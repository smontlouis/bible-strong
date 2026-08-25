export const RESOURCE_DEVELOPMENT_COMMANDS = [
  ['docker', 'compose', '-f', 'compose.yaml', 'up', '-d', '--wait'],
  ['yarn', 'migrate'],
] as const

export const shouldImportResourcePublications = (
  environment: Readonly<Record<string, string | undefined>>
): boolean => environment.RESOURCE_SKIP_IMPORT !== '1'

export const getDevelopmentEndpoints = ({
  port,
  lanAddress,
}: {
  port: number
  lanAddress?: string
}) => ({
  host: `http://localhost:${port}`,
  iosSimulator: `http://127.0.0.1:${port}`,
  androidEmulator: `http://10.0.2.2:${port}`,
  physicalDevice: lanAddress ? `http://${lanAddress}:${port}` : `http://<LAN-IP>:${port}`,
})
