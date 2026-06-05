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
