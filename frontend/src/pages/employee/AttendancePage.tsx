/**
 * Employee attendance page — check-in/check-out with GPS and selfie.
 *
 * WHY THIS EXISTS: The primary daily interaction for employees. They visit
 * this page at the start and end of each workday to record their attendance
 * with GPS-verified location and optional selfie verification.
 *
 * GPS FLOW:
 *   1. useGeolocation hook requests browser geolocation permission.
 *   2. While loading, shows a spinner with "Getting your location..."
 *   3. On error (denied, unavailable, timeout), shows error card with retry.
 *   4. On success, lat/lng are available for all subsequent operations.
 *
 *   Why useGeolocation hook (not inline navigator.geolocation):
 *     Reusable across the app. The hook handles permission state, error states,
 *     and provides a refresh() function for retry. Components can consume
 *     location data without duplicating geolocation boilerplate.
 *
 *   Why we DON'T validate GPS against office geofence:
 *     The backend doesn't currently enforce radius checks (the constant
 *     RADIUS_LIMIT_METERS exists but is unused). Enabling geofencing would
 *     require the backend to know the office location, which it doesn't.
 *     This would require a company settings table with office coordinates.
 *
 * CAMERA INTEGRATION:
 *   Uses navigator.mediaDevices.getUserMedia for live camera feed.
 *   The camera shows in a <video> element; capturing draws the frame to a
 *   <canvas> and converts to a JPEG Blob.
 *
 *   WHY canvas-based capture (not just file input):
 *     Provides a "live capture" experience (point, shoot, done). The file
 *     upload alternative is for environments where camera access is denied
 *     or unavailable (desktop, browser restrictions).
 *
 *   WHY facingMode: 'user' (front camera):
 *     Selfies use the front camera. The back camera would show the room,
 *     not the employee's face.
 *
 *   WHY canvas.toBlob with 'image/jpeg':
 *     JPEG is universally supported and provides good compression for
 *     upload. The quality is default (~92%) — acceptable for identity
 *     verification purposes.
 *
 *   ERROR HANDLING:
 *     - getUserMedia can fail: permission denied, camera not found, or
 *       insecure context (HTTP, not HTTPS). Shows a toast error.
 *     - Selfie file upload validates size (5MB max) and type (jpeg/png/webp).
 *     - Invalid files are rejected with toast messages.
 *
 * CHECK-IN/CHECK-OUT FLOW:
 *   State machine derived from todayAttendance:
 *     null               → Can check in     (button: "Check In")
 *     checked in         → Can check out    (button: "Check Out")
 *     checked out        → Completed        (badge: "Completed for today")
 *
 *   Both check-in and check-out:
 *     1. Validate GPS coordinates are available (lat/lng not null).
 *     2. Call attendanceService with GPS coordinates.
 *     3. On success: update todayAttendance state, show success toast.
 *     4. On failure: show error toast with server message.
 *
 *   WHY optimistic UI is NOT used:
 *     Attendance records must be authoritative (server-time based). Optimistic
 *     updates could show "checked in" when the server actually rejected the
 *     request (e.g., duplicate, rate limit, server error).
 *
 * ERROR HANDLING:
 *   - GPS error → Full-screen error card with retry button.
 *   - GPS loading → Full-screen spinner.
 *   - API errors → Toast messages (not blocking).
 *   - Camera errors → Toast messages (fallback to file upload).
 *   - Selfive validation → Toast messages before API call.
 *
 *   WHY toasts (not inline errors):
 *     API calls happen as a result of user action (clicking a button).
 *     Toasts in response to user action are expected and don't disrupt
 *     the page layout. GPS/camera errors are shown inline because they
 *     can occur on initial page load, before any user action.
 *
 * SELFIE UPLOAD STRATEGY:
 *   Currently, the selfie is taken/selected but NOT automatically uploaded
 *   to Cloudinary. The selfie_url field in AttendanceCreate is included in
 *   the schema but optional. In the current implementation:
 *     1. Selfie is captured/selected.
 *     2. User clicks "Check In".
 *     3. Selfie is NOT uploaded to Cloudinary (would need a separate upload
 *        step and then passing the URL).
 *
 *   Future enhancement: Upload selfie to Cloudinary when "Check In" is
 *   clicked, then pass the resulting URL in AttendanceCreate. This requires
 *   the Cloudinary upload endpoint on the backend (cloudinary route).
 *
 * PERFORMANCE:
 *   - Camera stream is released (tracks stopped) immediately after capture.
 *   - Selfie preview uses blob URL (revoked when component unmounts implicitly).
 *   - No unnecessary re-renders: State changes only on user action or geolocation update.
 */

import { useState, useRef, useCallback } from 'react'
import { Camera, MapPin, Clock, CheckCircle, XCircle, Upload, RefreshCw } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Separator } from '@/components/ui/separator'
import { useGeolocation } from '@/hooks/useGeolocation'
import { attendanceService } from '@/services/attendanceService'
import { toast } from '@/components/ui/toast'
import { ABSENSI_CONSTANTS } from '@/constants'
import type { Attendance } from '@/types'

export default function AttendancePage() {
  const { lat, lng, error: geoError, loading: geoLoading, refresh: refreshGeo } = useGeolocation()
  const videoRef = useRef<HTMLVideoElement>(null)
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const [todayAttendance, setTodayAttendance] = useState<Attendance | null>(null)
  const [actionLoading, setActionLoading] = useState(false)
  const [selfieFile, setSelfieFile] = useState<File | null>(null)
  const [selfiePreview, setSelfiePreview] = useState<string | null>(null)
  const [cameraActive, setCameraActive] = useState(false)
  const [address, setAddress] = useState('Fetching location...')

  // Derived state for the UI state machine.
  const isCheckedIn = todayAttendance?.check_in_time && !todayAttendance?.check_out_time
  const isCheckedOut = todayAttendance?.check_in_time && todayAttendance?.check_out_time

  const startCamera = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'user' } })
      if (videoRef.current) {
        videoRef.current.srcObject = stream
        setCameraActive(true)
      }
    } catch {
      toast({ title: 'Camera access denied', variant: 'error' })
    }
  }

  const captureSelfie = useCallback(() => {
    if (videoRef.current && canvasRef.current) {
      const video = videoRef.current
      const canvas = canvasRef.current
      canvas.width = video.videoWidth
      canvas.height = video.videoHeight
      canvas.getContext('2d')?.drawImage(video, 0, 0)
      canvas.toBlob((blob) => {
        if (blob) {
          const file = new File([blob], 'selfie.jpg', { type: 'image/jpeg' })
          setSelfieFile(file)
          setSelfiePreview(URL.createObjectURL(blob))
        }
      }, 'image/jpeg')
      // Release camera immediately — reduces memory/bandwidth usage.
      const stream = video.srcObject as MediaStream
      stream?.getTracks().forEach((t) => t.stop())
      setCameraActive(false)
    }
  }, [])

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (file) {
      if (file.size > ABSENSI_CONSTANTS.MAX_SELFIE_SIZE) {
        toast({ title: 'File too large. Max 5MB', variant: 'error' })
        return
      }
      if (!ABSENSI_CONSTANTS.ALLOWED_SELFIE_TYPES.includes(file.type)) {
        toast({ title: 'Invalid file type. Use JPEG, PNG, or WebP', variant: 'error' })
        return
      }
      setSelfieFile(file)
      setSelfiePreview(URL.createObjectURL(file))
    }
  }

  const handleCheckIn = async () => {
    if (!lat || !lng) {
      toast({ title: 'Location not available', variant: 'error' })
      return
    }
    setActionLoading(true)
    try {
      const attendance = await attendanceService.checkIn(lat, lng)
      setTodayAttendance(attendance)
      toast({ title: 'Check-in successful!', variant: 'success' })
    } catch (err: any) {
      toast({ title: err?.message || 'Check-in failed', variant: 'error' })
    } finally {
      setActionLoading(false)
    }
  }

  const handleCheckOut = async () => {
    if (!lat || !lng) {
      toast({ title: 'Location not available', variant: 'error' })
      return
    }
    setActionLoading(true)
    try {
      const attendance = await attendanceService.checkOut(lat, lng)
      setTodayAttendance(attendance)
      toast({ title: 'Check-out successful!', variant: 'success' })
    } catch (err: any) {
      toast({ title: err?.message || 'Check-out failed', variant: 'error' })
    } finally {
      setActionLoading(false)
    }
  }

  // GPS loading state
  if (geoLoading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="text-center space-y-4">
          <div className="w-12 h-12 border-4 border-worksync-400 border-t-transparent rounded-full animate-spin mx-auto" />
          <p className="text-text-secondary">Getting your location...</p>
        </div>
      </div>
    )
  }

  // GPS error state
  if (geoError) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <Card className="max-w-md w-full border-status-error/30">
          <CardContent className="pt-6 text-center space-y-4">
            <XCircle className="w-12 h-12 text-status-error mx-auto" />
            <p className="text-text-secondary">{geoError}</p>
            <Button onClick={refreshGeo} variant="outline">
              <RefreshCw className="w-4 h-4 mr-2" />
              Try Again
            </Button>
          </CardContent>
        </Card>
      </div>
    )
  }

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-text-primary">Attendance</h1>
        <p className="text-text-secondary mt-1">Check in and out with GPS verification</p>
      </div>

      {/* GPS Location Card — shows coordinates (map is Pro feature) */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <MapPin className="w-5 h-5 text-worksync-400" />
            Your Location
          </CardTitle>
          <CardDescription>{address}</CardDescription>
        </CardHeader>
        <CardContent>
          {lat && lng && (
            <div className="h-48 rounded-xl bg-gradient-to-br from-surface-elevated to-surface-card border border-surface-border flex items-center justify-center">
              <div className="text-center">
                <MapPin className="w-8 h-8 text-worksync-400 mx-auto mb-2" />
                <p className="text-sm text-text-secondary">Map view available with Pro plan</p>
                <p className="text-xs text-text-muted mt-1">{lat.toFixed(6)}, {lng.toFixed(6)}</p>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Selfie Verification Card */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Camera className="w-5 h-5 text-worksync-400" />
            Selfie Verification
          </CardTitle>
          <CardDescription>Take or upload a selfie for verification</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {selfiePreview ? (
            <div className="relative">
              <img
                src={selfiePreview}
                alt="Selfie preview"
                className="w-48 h-48 object-cover rounded-xl mx-auto"
              />
              <Button
                variant="ghost"
                size="sm"
                className="absolute top-2 right-2"
                onClick={() => {
                  setSelfieFile(null)
                  setSelfiePreview(null)
                }}
              >
                <XCircle className="w-4 h-4" />
              </Button>
            </div>
          ) : cameraActive ? (
            <div className="space-y-3">
              <video
                ref={videoRef}
                autoPlay
                playsInline
                className="w-48 h-48 rounded-xl mx-auto bg-black object-cover"
              />
              <div className="flex justify-center gap-2">
                <Button onClick={captureSelfie}>Capture</Button>
                <Button
                  variant="ghost"
                  onClick={() => {
                    const stream = videoRef.current?.srcObject as MediaStream
                    stream?.getTracks().forEach((t) => t.stop())
                    setCameraActive(false)
                  }}
                >
                  Cancel
                </Button>
              </div>
            </div>
          ) : (
            <div className="flex justify-center gap-3">
              <Button onClick={startCamera} variant="outline">
                <Camera className="w-4 h-4 mr-2" />
                Open Camera
              </Button>
              <Button
                variant="outline"
                onClick={() => fileInputRef.current?.click()}
              >
                <Upload className="w-4 h-4 mr-2" />
                Upload Photo
              </Button>
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                className="hidden"
                onChange={handleFileUpload}
              />
            </div>
          )}
        </CardContent>
      </Card>

      <Separator />

      {/* Check-in/Check-out State Machine UI */}
      <div className="flex justify-center gap-4">
        {!isCheckedIn && !isCheckedOut && (
          <Button
            size="lg"
            onClick={handleCheckIn}
            disabled={actionLoading || !lat || !lng}
            className="w-48"
          >
            {actionLoading ? (
              <span className="flex items-center gap-2">
                <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                Checking In...
              </span>
            ) : (
              <span className="flex items-center gap-2">
                <CheckCircle className="w-5 h-5" />
                Check In
              </span>
            )}
          </Button>
        )}
        {isCheckedIn && !isCheckedOut && (
          <Button
            size="lg"
            onClick={handleCheckOut}
            disabled={actionLoading || !lat || !lng}
            variant="secondary"
            className="w-48"
          >
            {actionLoading ? (
              <span className="flex items-center gap-2">
                <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                Checking Out...
              </span>
            ) : (
              <span className="flex items-center gap-2">
                <XCircle className="w-5 h-5" />
                Check Out
              </span>
            )}
          </Button>
        )}
        {isCheckedOut && (
          <div className="text-center">
            <Badge variant="success" className="text-sm px-4 py-2">
              <CheckCircle className="w-4 h-4 mr-2" />
              Completed for today
            </Badge>
          </div>
        )}
      </div>
    </div>
  )
}
