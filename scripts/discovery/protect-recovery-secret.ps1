param(
    [Parameter(Mandatory=$true)][ValidateSet('Protect','Unprotect','SecureDirectory')][string]$Action,
    [Parameter(Mandatory=$true)][string]$Path
)
$ErrorActionPreference = 'Stop'
Add-Type -AssemblyName System.Security
if ($Action -eq 'SecureDirectory') {
    $resolvedTarget = [IO.Path]::GetFullPath($Path)
    $workspaceTarget = [IO.Path]::GetFullPath((Join-Path $PSScriptRoot '..\..\.local'))
    if (-not $resolvedTarget.StartsWith($workspaceTarget + '\', [StringComparison]::OrdinalIgnoreCase)) { throw 'Target must be inside workspace .local' }
    [IO.Directory]::CreateDirectory($resolvedTarget) | Out-Null
    $acl = New-Object Security.AccessControl.DirectorySecurity
    $acl.SetAccessRuleProtection($true, $false)
    $sid = [Security.Principal.WindowsIdentity]::GetCurrent().User
    foreach ($identity in @($sid, [Security.Principal.SecurityIdentifier]'S-1-5-18', [Security.Principal.SecurityIdentifier]'S-1-5-32-544')) {
        $acl.AddAccessRule([Security.AccessControl.FileSystemAccessRule]::new($identity, 'FullControl', 'ContainerInherit,ObjectInherit', 'None', 'Allow'))
    }
    Set-Acl -LiteralPath $resolvedTarget -AclObject $acl
} elseif ($Action -eq 'Protect') {
    if (Test-Path -LiteralPath $Path) { throw 'Refusing to overwrite recovery secret' }
    $bytes = [Text.Encoding]::UTF8.GetBytes([Console]::In.ReadToEnd())
    try {
        $protected = [Security.Cryptography.ProtectedData]::Protect($bytes, $null, [Security.Cryptography.DataProtectionScope]::CurrentUser)
        $stream = [IO.File]::Open($Path, [IO.FileMode]::CreateNew)
        try { $stream.Write($protected, 0, $protected.Length) } finally { $stream.Dispose() }
    } finally { [Array]::Clear($bytes, 0, $bytes.Length) }
} else {
    # For a private child-process pipe only. Never run directly in a visible terminal.
    $bytes = [Security.Cryptography.ProtectedData]::Unprotect([IO.File]::ReadAllBytes($Path), $null, [Security.Cryptography.DataProtectionScope]::CurrentUser)
    try { [Console]::Out.Write([Text.Encoding]::UTF8.GetString($bytes)) } finally { [Array]::Clear($bytes, 0, $bytes.Length) }
}
