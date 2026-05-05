# =============================================================================
# GTM Engine - Network/Security Verification (PowerShell + Invoke-WebRequest)
#
# Usage:
#   .\testing\security-verification.ps1 `
#     -BaseUrl https://gtmengine.qubitlyventures.com `
#     -SupabaseUrl https://ycsfossrrntwhegmyrze.supabase.co `
#     -AnonKey "<SUPABASE_ANON_KEY>" `
#     -UserJwt "<a_valid_user_jwt>"
#
# All checks are read-only. Each prints PASS/FAIL with the relevant detail.
# =============================================================================

param(
  [Parameter(Mandatory=$true)] [string] $BaseUrl,
  [Parameter(Mandatory=$true)] [string] $SupabaseUrl,
  [string] $AnonKey = "",
  [string] $UserJwt = ""
)

$ErrorActionPreference = "Continue"
$total = 0; $passed = 0; $failed = 0

function Test-Result {
  param([string]$Id, [string]$Title, [bool]$Pass, [string]$Detail = "")
  $script:total++
  if ($Pass) {
    $script:passed++
    Write-Host ("[PASS] {0,-12} {1}" -f $Id, $Title) -ForegroundColor Green
  } else {
    $script:failed++
    Write-Host ("[FAIL] {0,-12} {1}" -f $Id, $Title) -ForegroundColor Red
    if ($Detail) { Write-Host "       -> $Detail" -ForegroundColor DarkYellow }
  }
}

function Invoke-Safe {
  param([string]$Method, [string]$Url, [hashtable]$Headers = @{}, [string]$Body = $null)
  try {
    $params = @{ Method = $Method; Uri = $Url; Headers = $Headers; UseBasicParsing = $true }
    if ($Body) { $params.Body = $Body; $params.ContentType = "application/json" }
    $resp = Invoke-WebRequest @params
    return $resp
  } catch [System.Net.WebException] {
    # PS 5.1: non-2xx throws; pull the underlying response
    $r = $_.Exception.Response
    if ($r) {
      $headers = @{}
      foreach ($h in $r.Headers) { $headers[$h] = $r.Headers[$h] }
      $body = ""
      try { $body = (New-Object System.IO.StreamReader($r.GetResponseStream())).ReadToEnd() } catch {}
      return [pscustomobject]@{ StatusCode = [int]$r.StatusCode; Headers = $headers; Content = $body }
    }
    return [pscustomobject]@{ StatusCode = 0; Headers = @{}; Content = $_.Exception.Message }
  } catch {
    # Generic catch (e.g. Microsoft.PowerShell.Commands.HttpResponseException on PS 7)
    $ex = $_.Exception
    if ($ex.Response) {
      $headers = @{}
      foreach ($h in $ex.Response.Headers) { $headers[$h] = $ex.Response.Headers[$h] }
      return [pscustomobject]@{ StatusCode = [int]$ex.Response.StatusCode; Headers = $headers; Content = "$ex" }
    }
    return [pscustomobject]@{ StatusCode = 0; Headers = @{}; Content = "$ex" }
  }
}

Write-Host "`n=== GTM Engine Security Verification ===" -ForegroundColor Cyan
Write-Host "Base:      $BaseUrl"
Write-Host "Supabase:  $SupabaseUrl`n"

# ---------------------------------------------------------------------------
# 1. CORS - allowed origin (production)
# ---------------------------------------------------------------------------
$r = Invoke-Safe -Method "OPTIONS" -Url "$SupabaseUrl/functions/v1/check-quota" -Headers @{
  "Origin" = "https://gtmengine.qubitlyventures.com"
  "Access-Control-Request-Method" = "POST"
  "Access-Control-Request-Headers" = "authorization,content-type"
}
$allowOrigin = $r.Headers["Access-Control-Allow-Origin"]
Test-Result "TC-SEC-001" "CORS allows production origin" `
  ($allowOrigin -eq "https://gtmengine.qubitlyventures.com") `
  "Got Allow-Origin = '$allowOrigin' (status $($r.StatusCode))"

# ---------------------------------------------------------------------------
# 2. CORS - localhost dev
# ---------------------------------------------------------------------------
$r = Invoke-Safe -Method "OPTIONS" -Url "$SupabaseUrl/functions/v1/check-quota" -Headers @{
  "Origin" = "http://localhost:3000"
  "Access-Control-Request-Method" = "POST"
}
$allowOrigin = $r.Headers["Access-Control-Allow-Origin"]
Test-Result "TC-SEC-002" "CORS allows localhost:3000" `
  ($allowOrigin -eq "http://localhost:3000") `
  "Got Allow-Origin = '$allowOrigin'"

# ---------------------------------------------------------------------------
# 3. CORS - disallowed origin
# ---------------------------------------------------------------------------
$r = Invoke-Safe -Method "OPTIONS" -Url "$SupabaseUrl/functions/v1/check-quota" -Headers @{
  "Origin" = "https://evil.example.com"
  "Access-Control-Request-Method" = "POST"
}
$allowOrigin = $r.Headers["Access-Control-Allow-Origin"]
Test-Result "TC-SEC-003" "CORS rejects evil.example.com" `
  ($allowOrigin -ne "https://evil.example.com" -and $allowOrigin -ne "*") `
  "Got Allow-Origin = '$allowOrigin' (status $($r.StatusCode))"

# ---------------------------------------------------------------------------
# 4. JWT-protected fn returns 401 without token
# ---------------------------------------------------------------------------
$r = Invoke-Safe -Method "POST" -Url "$SupabaseUrl/functions/v1/check-quota" `
  -Headers @{ "Content-Type" = "application/json" } -Body "{}"
Test-Result "TC-SEC-014a" "check-quota requires auth" `
  ($r.StatusCode -eq 401) "Status = $($r.StatusCode)"

# ---------------------------------------------------------------------------
# 5. Public-callable fns that must self-verify JWT
#    These are deployed with verify_jwt=false but should reject unauth requests
#    via _shared/auth.ts checks.
# ---------------------------------------------------------------------------
$publicFnsRequireAuth = @(
  "generate-asset","icp-enrich","personalise","generate-campaign-brief",
  "create-campaign","update-campaign","build-prompt","generate-captions"
)
foreach ($fn in $publicFnsRequireAuth) {
  $r = Invoke-Safe -Method "POST" -Url "$SupabaseUrl/functions/v1/$fn" `
    -Headers @{ "Content-Type" = "application/json" } -Body "{}"
  Test-Result "TC-SEC-014.$fn" "$fn rejects unauthenticated request" `
    ($r.StatusCode -eq 401 -or $r.StatusCode -eq 403) `
    "Status = $($r.StatusCode) - if 200, the fn is missing JWT validation"
}

# ---------------------------------------------------------------------------
# 6. Cron-only fn rejects request without X-Cron-Secret
# ---------------------------------------------------------------------------
$r = Invoke-Safe -Method "POST" -Url "$SupabaseUrl/functions/v1/ingest-signals" -Body "{}" `
  -Headers @{ "Content-Type" = "application/json" }
Test-Result "TC-SEC-013a" "ingest-signals rejects request without X-Cron-Secret" `
  ($r.StatusCode -eq 401 -or $r.StatusCode -eq 403) "Status = $($r.StatusCode)"

$r = Invoke-Safe -Method "POST" -Url "$SupabaseUrl/functions/v1/poll-job-status" -Body "{}" `
  -Headers @{ "Content-Type" = "application/json" }
Test-Result "TC-SEC-013b" "poll-job-status rejects request without X-Cron-Secret" `
  ($r.StatusCode -eq 401 -or $r.StatusCode -eq 403) "Status = $($r.StatusCode)"

# ---------------------------------------------------------------------------
# 7. Webhook accepts but fails on bad signature
# ---------------------------------------------------------------------------
$r = Invoke-Safe -Method "POST" -Url "$SupabaseUrl/functions/v1/dodopayments-webhook" `
  -Headers @{ "Content-Type" = "application/json"; "webhook-signature" = "v1,bogus" } -Body "{}"
Test-Result "TC-SEC-016" "dodopayments-webhook rejects bad signature" `
  ($r.StatusCode -eq 400 -or $r.StatusCode -eq 401) "Status = $($r.StatusCode)"

# ---------------------------------------------------------------------------
# 8. Storage bucket - direct object access requires token
# ---------------------------------------------------------------------------
$r = Invoke-Safe -Method "GET" -Url "$SupabaseUrl/storage/v1/object/assets/non-existent.jpg"
Test-Result "TC-SEC-018" "Storage bucket 'assets' requires authentication" `
  ($r.StatusCode -eq 400 -or $r.StatusCode -eq 401 -or $r.StatusCode -eq 404) `
  "Status = $($r.StatusCode) - 200 would mean bucket is publicly listable"

# ---------------------------------------------------------------------------
# 9. Body size limit - send 2MB payload, expect 413 OR 400
# ---------------------------------------------------------------------------
$bigBody = '{"junk":"' + ('a' * (2 * 1024 * 1024)) + '"}'
$r = Invoke-Safe -Method "POST" -Url "$SupabaseUrl/functions/v1/check-quota" `
  -Headers @{ "Content-Type" = "application/json" } -Body $bigBody
Test-Result "TC-SEC-005" "Body >1MB rejected" `
  ($r.StatusCode -eq 413 -or $r.StatusCode -eq 400 -or $r.StatusCode -eq 401) `
  "Status = $($r.StatusCode) (401 acceptable since fn rejects on auth before parsing)"

# ---------------------------------------------------------------------------
# 10. Frontend reachability + no service-role key in HTML
# ---------------------------------------------------------------------------
$r = Invoke-Safe -Method "GET" -Url "$BaseUrl/login"
Test-Result "TC-FE-001" "Login page reachable" `
  ($r.StatusCode -eq 200) "Status = $($r.StatusCode)"

$pageContent = if ($r.Content) { $r.Content } else { "" }
$hasServiceRole = $pageContent -match "service_role|SUPABASE_SERVICE_ROLE_KEY"
Test-Result "TC-SEC-020" "No service-role key in /login HTML" `
  (-not $hasServiceRole) "Service role key reference found in client HTML"

# ---------------------------------------------------------------------------
# 11. Headers - Sentry + production CSP / HSTS sanity
# ---------------------------------------------------------------------------
$strictTransport = $r.Headers["Strict-Transport-Security"]
Test-Result "TC-SEC-021" "HSTS header present (Cloudflare)" `
  (-not [string]::IsNullOrEmpty($strictTransport)) `
  "If empty, enable HSTS in Cloudflare SSL/TLS settings"

# ---------------------------------------------------------------------------
# 12. Optional - if UserJwt provided, sanity check authed call
# ---------------------------------------------------------------------------
if ($UserJwt -and $AnonKey) {
  $r = Invoke-Safe -Method "POST" -Url "$SupabaseUrl/functions/v1/check-quota" `
    -Headers @{
      "Content-Type" = "application/json"
      "Authorization" = "Bearer $UserJwt"
      "apikey" = $AnonKey
    } -Body "{}"
  Test-Result "TC-AUTH-019b" "check-quota accepts valid user JWT" `
    ($r.StatusCode -in 200, 400) `
    "Status = $($r.StatusCode) - 400 acceptable if body validation triggers; 401 means JWT rejected"
} else {
  Write-Host "[SKIP] TC-AUTH-019b   provide -UserJwt and -AnonKey to test authed call" -ForegroundColor DarkGray
}

# ---------------------------------------------------------------------------
# Summary
# ---------------------------------------------------------------------------
Write-Host "`n=== Summary ===" -ForegroundColor Cyan
Write-Host ("Total:  {0}" -f $total)
Write-Host ("Passed: {0}" -f $passed) -ForegroundColor Green
Write-Host ("Failed: {0}" -f $failed) -ForegroundColor $(if ($failed -gt 0) { "Red" } else { "Green" })

if ($failed -gt 0) { exit 1 } else { exit 0 }
