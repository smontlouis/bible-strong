export const RESOURCE_DEVELOPMENT_COMMANDS = [
  ['docker', 'compose', '-f', 'resource-service/compose.yaml', 'up', '-d', '--wait'],
  ['yarn', 'resources:migrate'],
] as const

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
