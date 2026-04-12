$BASE = "https://zmsactoninhdtngtlyep.supabase.co"
$ANON = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inptc2FjdG9uaW5oZHRuZ3RseWVwIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzU3NTk2ODksImV4cCI6MjA5MTMzNTY4OX0.FDgdXuVaDJe_yM5S9UhVB-Y-PEcbBQOm5M-ndAeJMWQ"

$pass = 0
$fail = 0

function Show-Result($label, $ok, $detail = "") {
    if ($ok) {
        Write-Host "   [PASS] $label $detail" -ForegroundColor Green
        $script:pass++
    } else {
        Write-Host "   [FAIL] $label $detail" -ForegroundColor Red
        $script:fail++
    }
}

Write-Host "`n============================================" -ForegroundColor Cyan
Write-Host "  APPETITE - EDGE FUNCTION TEST SUITE" -ForegroundColor Cyan
Write-Host "  $BASE" -ForegroundColor Cyan
Write-Host "============================================`n" -ForegroundColor Cyan

# ---- 1. Auth ----
Write-Host "--- AUTH ---" -ForegroundColor Magenta
$JWT = $null
$credentials = @(
    @{email="admin@appetite.com"; password="admin123!"},
    @{email="malverneas@gmail.com"; password="Marte@2026"}
)

foreach ($cred in $credentials) {
    try {
        $body = $cred | ConvertTo-Json
        $url = "$BASE/auth/v1/token?grant_type=password"
        $r = Invoke-RestMethod -Uri $url -Method POST -Headers @{ apikey=$ANON; "Content-Type"="application/json" } -Body $body
        $JWT = $r.access_token
        Show-Result "Login ($($cred.email))" $true "uid=$($r.user.id.Substring(0,8))..."
        break
    } catch {
        $code = $_.Exception.Response.StatusCode.value__
        Show-Result "Login ($($cred.email))" $false "HTTP $code"
    }
}

if (-not $JWT) {
    Write-Host "`n[!] No JWT - auth-protected tests will show 401. Continuing anyway...`n" -ForegroundColor Yellow
}
$H = @{ apikey=$ANON; Authorization="Bearer $JWT"; "Content-Type"="application/json" }

# ---- 2. sign_paynow ----
Write-Host "`n--- PAYNOW ---" -ForegroundColor Magenta
try {
    $body = @{
        amount="5.50"; reference="TEST-001"
        return_url="https://appetite.co.zw/return"
        result_url="$BASE/functions/v1/paynow_webhook"
        customer_email="test@test.com"
    } | ConvertTo-Json
    $url = "$BASE/functions/v1/sign_paynow"
    $r = Invoke-RestMethod -Uri $url -Method POST -Headers $H -Body $body
    Show-Result "sign_paynow" $true "Got redirect URL"
} catch {
    $code = $_.Exception.Response.StatusCode.value__
    Show-Result "sign_paynow" ($code -lt 500) "HTTP $code ($(if($code -lt 500){'function alive'}else{'server error'}))"
}

# ---- 3. check_payment_status ----
try {
    $body = @{ order_id="8c19e476-ddc1-45cd-a48d-80f92f2c1f06" } | ConvertTo-Json
    $url = "$BASE/functions/v1/check_payment_status"
    $r = Invoke-RestMethod -Uri $url -Method POST -Headers $H -Body $body
    Show-Result "check_payment_status" $true "Responded OK"
} catch {
    $code = $_.Exception.Response.StatusCode.value__
    Show-Result "check_payment_status" ($code -lt 500) "HTTP $code"
}

# ---- 4. notify_customer ----
Write-Host "`n--- NOTIFICATIONS ---" -ForegroundColor Magenta
try {
    $body = @{ order_id="8c19e476-ddc1-45cd-a48d-80f92f2c1f06"; event="confirmed" } | ConvertTo-Json
    $url = "$BASE/functions/v1/notify_customer"
    $r = Invoke-RestMethod -Uri $url -Method POST -Headers $H -Body $body
    Show-Result "notify_customer" $true
} catch {
    $code = $_.Exception.Response.StatusCode.value__
    Show-Result "notify_customer" ($code -lt 500) "HTTP $code"
}

# ---- 5. notify_drivers ----
try {
    $body = @{ order_id="8c19e476-ddc1-45cd-a48d-80f92f2c1f06" } | ConvertTo-Json
    $url = "$BASE/functions/v1/notify_drivers"
    $r = Invoke-RestMethod -Uri $url -Method POST -Headers $H -Body $body
    Show-Result "notify_drivers" $true
} catch {
    $code = $_.Exception.Response.StatusCode.value__
    Show-Result "notify_drivers" ($code -lt 500) "HTTP $code"
}

# ---- 6. notify_restaurant ----
try {
    $body = @{ order_id="8c19e476-ddc1-45cd-a48d-80f92f2c1f06" } | ConvertTo-Json
    $url = "$BASE/functions/v1/notify_restaurant"
    $r = Invoke-RestMethod -Uri $url -Method POST -Headers $H -Body $body
    Show-Result "notify_restaurant" $true
} catch {
    $code = $_.Exception.Response.StatusCode.value__
    Show-Result "notify_restaurant" ($code -lt 500) "HTTP $code"
}

# ---- 7. notify_user ----
try {
    $body = @{ user_id="da19f995-6b21-495c-a2a8-2c516ec87ce2"; title="Test"; body="Hello" } | ConvertTo-Json
    $url = "$BASE/functions/v1/notify_user"
    $r = Invoke-RestMethod -Uri $url -Method POST -Headers $H -Body $body
    Show-Result "notify_user" $true
} catch {
    $code = $_.Exception.Response.StatusCode.value__
    Show-Result "notify_user" ($code -lt 500) "HTTP $code"
}

# ---- 8. send_order_email ----
Write-Host "`n--- EMAIL ---" -ForegroundColor Magenta
try {
    $body = @{ order_id="8c19e476-ddc1-45cd-a48d-80f92f2c1f06" } | ConvertTo-Json
    $url = "$BASE/functions/v1/send_order_email"
    $r = Invoke-RestMethod -Uri $url -Method POST -Headers $H -Body $body
    Show-Result "send_order_email" $true
} catch {
    $code = $_.Exception.Response.StatusCode.value__
    Show-Result "send_order_email" ($code -lt 500) "HTTP $code"
}

# ---- 9. place_order (GET probe only) ----
Write-Host "`n--- ORDER ---" -ForegroundColor Magenta
try {
    $url = "$BASE/functions/v1/place_order"
    $r = Invoke-RestMethod -Uri $url -Method POST -Headers $H -Body "{}"
    Show-Result "place_order" $true "Responded"
} catch {
    $code = $_.Exception.Response.StatusCode.value__
    Show-Result "place_order" ($code -lt 500) "HTTP $code"
}

# ---- 10. REST API sanity ----
Write-Host "`n--- DATABASE ---" -ForegroundColor Magenta
try {
    $url = $BASE + "/rest/v1/restaurants?select=id,name&limit=3"
    $r = Invoke-RestMethod -Uri $url -Headers @{ apikey=$ANON; Authorization="Bearer $ANON" }
    Show-Result "REST API (restaurants)" ($r.Count -gt 0) "Got $($r.Count) rows"
} catch {
    Show-Result "REST API (restaurants)" $false $_
}
try {
    $url = $BASE + "/rest/v1/restaurant_locations?select=id&limit=1"
    $r = Invoke-RestMethod -Uri $url -Headers @{ apikey=$ANON; Authorization="Bearer $ANON" }
    Show-Result "REST API (locations)" $true "Accessible"
} catch {
    Show-Result "REST API (locations)" $false $_
}

# ---- Summary ----
$total = $pass + $fail
Write-Host "`n============================================" -ForegroundColor Cyan
Write-Host "  RESULTS: $pass/$total passed" -ForegroundColor $(if ($fail -eq 0) { 'Green' } else { 'Yellow' })
Write-Host "============================================`n" -ForegroundColor Cyan
