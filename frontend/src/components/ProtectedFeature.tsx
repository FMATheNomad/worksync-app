import { SUBSCRIPTION_PLANS } from '@/constants'
import type { SubscriptionPlan } from '@/types'

import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Lock, Sparkles } from 'lucide-react'

interface ProtectedFeatureProps {
  feature: keyof typeof SUBSCRIPTION_PLANS['free']['features']
  currentPlan: SubscriptionPlan
  children: React.ReactNode
  fallback?: React.ReactNode
}

export function ProtectedFeature({ feature, currentPlan, children, fallback }: ProtectedFeatureProps) {
  const planFeatures = SUBSCRIPTION_PLANS[currentPlan]?.features
  const hasAccess = planFeatures?.[feature]

  if (hasAccess) return <>{children}</>

  if (fallback) return <>{fallback}</>

  return (
    <Card className="border-status-warning/30 bg-status-warning/5">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-status-warning">
          <Lock className="w-5 h-5" />
          Premium Feature
        </CardTitle>
        <CardDescription>
          Upgrade your plan to access this feature.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <p className="text-sm text-text-secondary">
          This feature requires a {currentPlan === 'free' ? 'Pro or Enterprise' : 'Enterprise'} subscription.
        </p>
        <div className="flex gap-3">
          {currentPlan === 'free' && (
            <Button className="bg-gradient-to-r from-worksync-500 to-worksync-700">
              <Sparkles className="w-4 h-4 mr-2" />
              Upgrade to Pro
            </Button>
          )}
          {(currentPlan === 'free' || currentPlan === 'pro') && (
            <Button variant="outline">
              Upgrade to Enterprise
            </Button>
          )}
        </div>
        <div className="mt-4 space-y-2">
          <p className="text-xs font-medium text-text-muted uppercase">Available on higher plans:</p>
          {Object.entries(SUBSCRIPTION_PLANS).map(([plan, data]) => {
            if (plan === currentPlan) return null
            const hasIt = data.features[feature]
            if (!hasIt) return null
            return (
              <div key={plan} className="flex items-center gap-2 text-sm text-text-secondary">
                <Sparkles className="w-3.5 h-3.5 text-accent-500" />
                <span className="capitalize">{plan} plan</span>
              </div>
            )
          })}
        </div>
      </CardContent>
    </Card>
  )
}
