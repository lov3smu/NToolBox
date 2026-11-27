import { describe, expect, it } from 'vitest'
import {
  normalizeCertificateInfo,
  normalizePortList,
  normalizeSslTarget,
  parseListeningPorts,
  parseNetstatWindows,
  parseTasklist
} from '../src/shared/systemTools.js'

describe('systemTools port parsing', () => {
  it('parses ss output for tcp listeners and udp sockets', () => {
    const output = [
      'Netid State  Recv-Q Send-Q Local Address:Port Peer Address:PortProcess',
      'tcp   LISTEN 0      4096   127.0.0.1:3306       0.0.0.0:*',
      'tcp   LISTEN 0      511    [::]:5173            [::]:*     users:(("node",pid=4021,fd=23))',
      'udp   UNCONN 0      0      127.0.0.53%lo:53     0.0.0.0:*'
    ].join('\n')
    const items = parseListeningPorts(output, 'ss')
    expect(items).toEqual([
      { protocol: 'udp', address: '127.0.0.53', port: 53, pid: null, process: '' },
      { protocol: 'tcp', address: '127.0.0.1', port: 3306, pid: null, process: '' },
      { protocol: 'tcp', address: '::', port: 5173, pid: 4021, process: 'node' }
    ])
  })

  it('skips non-listening tcp rows and header lines', () => {
    const output = ['tcp ESTAB 0 0 10.0.0.1:22 10.0.0.2:55000', 'udp UNCONN 0 0 0.0.0.0:68 0.0.0.0:*'].join('\n')
    expect(parseListeningPorts(output, 'ss')).toEqual([
      { protocol: 'udp', address: '0.0.0.0', port: 68, pid: null, process: '' }
    ])
  })

  it('parses linux netstat output with pids', () => {
    const output = [
      'tcp        0      0 0.0.0.0:22              0.0.0.0:*               LISTEN      1234/sshd',
      'udp        0      0 127.0.0.1:53            0.0.0.0:*                           789/dnsmasq',
      'tcp        0      0 10.0.0.1:22             10.0.0.2:50123          ESTABLISHED 1234/sshd'
    ].join('\n')
    const items = parseListeningPorts(output, 'netstat')
    expect(items).toEqual([
      { protocol: 'tcp', address: '0.0.0.0', port: 22, pid: 1234, process: 'sshd' },
      { protocol: 'udp', address: '127.0.0.1', port: 53, pid: 789, process: 'dnsmasq' }
    ])
  })

  it('parses windows netstat with tasklist names', () => {
    const netstat = [
      '  TCP    0.0.0.0:135            0.0.0.0:0              LISTENING       912',
      '  TCP    127.0.0.1:5432         0.0.0.0:0              LISTENING       4500',
      '  UDP    0.0.0.0:5353           *:*                                    1600',
      '  TCP    10.0.0.1:5000         10.0.0.2:51000         ESTABLISHED     5200'
    ].join('\r\n')
    const tasklist = ['"System","4","Services","0","1,024 K"', '"postgres.exe","4500","Services","0","20,000 K"'].join(
      '\r\n'
    )
    const names = parseTasklist(tasklist)
    expect(names).toEqual({ 4: 'System', 4500: 'postgres.exe' })
    const items = parseNetstatWindows(netstat, names)
    expect(items).toEqual([
      { protocol: 'tcp', address: '0.0.0.0', port: 135, pid: 912, process: '' },
      { protocol: 'udp', address: '0.0.0.0', port: 5353, pid: 1600, process: '' },
      { protocol: 'tcp', address: '127.0.0.1', port: 5432, pid: 4500, process: 'postgres.exe' }
    ])
  })

  it('parses lsof output for tcp and udp sockets', () => {
    const output = [
      'COMMAND PID USER FD TYPE DEVICE SIZE/OFF NODE NAME',
      'node 4021 user 23u IPv6 0x123 0t0 TCP *:5173 (LISTEN)',
      'systemd-resolve 789 systemd-resolve 13u IPv4 12345 0t0 UDP 127.0.0.53:53',
      'node 4021 user 25u IPv4 0x456 0t0 TCP 127.0.0.1:5173->127.0.0.1:55000 (ESTABLISHED)'
    ].join('\n')
    expect(parseListeningPorts(output, 'lsof')).toEqual([
      { protocol: 'udp', address: '127.0.0.53', port: 53, pid: 789, process: 'systemd-resolve' },
      { protocol: 'tcp', address: '*', port: 5173, pid: 4021, process: 'node' }
    ])
  })

  it('normalizes, dedupes and sorts port entries', () => {
    const items = normalizePortList([
      { protocol: 'tcp', address: '127.0.0.1', port: 3000, pid: 10, process: 'a' },
      { protocol: 'tcp', address: '127.0.0.1', port: 3000, pid: 10, process: 'a' },
      { protocol: 'udp', address: '0.0.0.0', port: 53, pid: null, process: '' },
      { protocol: 'tcp', address: '0.0.0.0', port: 0, pid: 1 },
      { protocol: 'sctp', address: '0.0.0.0', port: 9 }
    ])
    expect(items.map((item) => `${item.protocol}:${item.port}`)).toEqual(['udp:53', 'tcp:3000'])
  })
})

describe('systemTools ssl targets', () => {
  it('normalizes hosts, urls and ports', () => {
    expect(normalizeSslTarget('example.com')).toEqual({ host: 'example.com', port: 443, servername: '' })
    expect(normalizeSslTarget('example.com:8443')).toEqual({ host: 'example.com', port: 8443, servername: '' })
    expect(normalizeSslTarget('https://example.com:9443/api?x=1')).toEqual({
      host: 'example.com',
      port: 9443,
      servername: ''
    })
    expect(normalizeSslTarget({ host: 'example.com', port: 443, servername: 'api.example.com' })).toEqual({
      host: 'example.com',
      port: 443,
      servername: 'api.example.com'
    })
    expect(normalizeSslTarget('[::1]:8443')).toEqual({ host: '::1', port: 8443, servername: '' })
    expect(normalizeSslTarget('::1')).toEqual({ host: '::1', port: 443, servername: '' })
  })

  it('rejects invalid targets', () => {
    expect(normalizeSslTarget('')).toBeNull()
    expect(normalizeSslTarget('ftp://example.com')).toBeNull()
    expect(normalizeSslTarget('example.com:0')).toBeNull()
    expect(normalizeSslTarget('example.com:70000')).toBeNull()
    expect(normalizeSslTarget('bad host')).toBeNull()
    expect(normalizeSslTarget('http://bad host/')).toBeNull()
    expect(normalizeSslTarget({ host: 'example.com', port: 'abc' })).toBeNull()
    expect(normalizeSslTarget({ host: 'example.com', servername: 'bad/sni' })).toBeNull()
  })

  it('normalizes certificate responses', () => {
    expect(normalizeCertificateInfo(null)).toEqual({ success: false, error: 'invalid-input' })
    expect(normalizeCertificateInfo({ success: false, error: 'timeout' })).toEqual({
      success: false,
      error: 'timeout'
    })
    expect(
      normalizeCertificateInfo({
        success: true,
        host: 'example.com',
        port: '443',
        protocol: 'TLSv1.3',
        authorized: true,
        subject: 'example.com',
        issuer: 'Test CA',
        validFrom: '2026-01-01T00:00:00.000Z',
        validTo: '2027-01-01T00:00:00.000Z',
        daysRemaining: 36.9,
        chainLength: 2,
        subjectAltName: 'DNS:example.com'
      })
    ).toMatchObject({
      success: true,
      host: 'example.com',
      port: 443,
      authorized: true,
      daysRemaining: 36,
      chainLength: 2
    })
  })
})
