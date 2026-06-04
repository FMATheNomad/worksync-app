import { useState, useEffect } from 'react'
import { CreditCard, Sparkles, Check, ChevronRight } from 'lucide-react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import { SUBSCRIPTION_PLANS } from '@/constants'
import { billingService } from '@/services/billingService'
import { toast } from '@/components/ui/toast'
import { useAuthStore } from '@/stores/authStore'
import type { SubscriptionPlan, Subscription } from '@/types'

const planOrder: SubscriptionPlan[] = ['free', 'pro', 'enterprise']

const FEATURE_LABELS: Record<string, string> = {
  users: 'team members',
  aiAssistant: 'AI Assistant',
  exportExcel: 'Excel Export',
  unlimitedEmployees: 'Unlimited Employees',
  prioritySupport: 'Priority Support',
  customBranding: 'Custom Branding',
}

export default function BillingPage() {
  const user = useAuthStore((s) => s.user)
  const [subscription, setSubscription] = useState<Subscription | null>(null)
  const [loading, setLoading] = useState(true)
  const [checkoutLoading, setCheckoutLoading] = useState(false)
  const [yearly, setYearly] = useState(false)

  useEffect(() => {
    loadSubscription()
  }, [])

  const loadSubscription = async () => {
    try {
      const data = await billingService.getSubscription()
      setSubscription(data)
    } catch {
    } finally {
      setLoading(false)
    }
  }

  const handleUpgrade = async (planId: string) => {
    setCheckoutLoading(true)
    try {
      const { checkout_url } = await billingService.createCheckout(planId)
      window.open(checkout_url, '_blank')
      toast({ title: 'Redirecting to checkout...', variant: 'info' })
    } catch (err: any) {
      toast({ title: err?.message || 'Checkout failed', variant: 'error' })
    } finally {
      setCheckoutLoading(false)
    }
  }

  const currentPlan = user?.subscriptionPlan || 'free'

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-text-primary">Billing & Subscription</h1>
        <p className="text-text-secondary mt-1">Manage your plan and billing information</p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <CreditCard className="w-5 h-5 text-worksync-400" />
            Current Plan
          </CardTitle>
          <CardDescription>Your active subscription details</CardDescription>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="space-y-2">
              <Skeleton className="h-6 w-32" />
              <Skeleton className="h-4 w-48" />
            </div>
          ) : (
            <div className="flex items-center justify-between">
              <div>
                <div className="flex items-center gap-2">
                  <h3 className="text-xl font-bold text-text-primary capitalize">
                    {currentPlan}
                  </h3>
                  <Badge variant={(subscription?.status === 'active') ? 'success' : 'warning'}>
                    {subscription?.status || 'active'}
                  </Badge>
                </div>
                <p className="text-sm text-text-secondary mt-1">
                  Up to {SUBSCRIPTION_PLANS[currentPlan]?.limits.maxUsers} team members
                </p>
              </div>
              <div className="text-right">
                <p className="text-2xl font-bold text-text-primary">
                  ${(SUBSCRIPTION_PLANS[currentPlan]?.price / 100).toFixed(0)}
                </p>
                <p className="text-xs text-text-muted">/month</p>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      <div className="flex items-center justify-center gap-3 mb-4">
        <span className={`text-sm ${!yearly ? 'text-text-primary font-semibold' : 'text-text-muted'}`}>Monthly</span>
        <button
          onClick={() => setYearly(!yearly)}
          className={`relative w-12 h-6 rounded-full transition-colors ${yearly ? 'bg-worksync-600' : 'bg-surface-border'}`}
        >
          <div className={`absolute top-0.5 w-5 h-5 rounded-full bg-white transition-transform ${yearly ? 'translate-x-6' : 'translate-x-0.5'}`} />
        </button>
        <span className={`text-sm ${yearly ? 'text-text-primary font-semibold' : 'text-text-muted'}`}>
          Yearly
          <span className="text-status-success ml-1">-20%</span>
        </span>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {planOrder.map((planKey) => {
          const plan = SUBSCRIPTION_PLANS[planKey]
          const isCurrent = currentPlan === planKey
          const price = yearly ? plan.yearlyPrice : plan.price
          const priceLabel = yearly ? '/year' : '/month'

          return (
            <Card
              key={planKey}
              className={`relative transition-all duration-300 ${
                isCurrent
                  ? 'border-worksync-600 shadow-lg shadow-worksync-600/10'
                  : 'hover:border-worksync-600/50'
              }`}
            >
              {planKey === 'pro' && (
                <div className="absolute -top-3 left-1/2 -translate-x-1/2">
                  <Badge variant="default" className="bg-gradient-to-r from-worksync-500 to-worksync-700">
                    <Sparkles className="w-3 h-3 mr-1" />
                    Popular
                  </Badge>
                </div>
              )}
              <CardHeader>
                <CardTitle className="capitalize">{plan.name}</CardTitle>
                <CardDescription>
                  <span className="text-3xl font-bold text-text-primary">
                    ${(price / 100).toFixed(price % 100 === 0 ? 0 : 2)}
                  </span>
                  <span className="text-text-muted">{priceLabel}</span>
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <ul className="space-y-2">
                  {Object.entries(plan.features).map(([key, value]) => (
                    <li key={key} className="flex items-start gap-2 text-sm">
                      {value ? (
                        <Check className="w-4 h-4 text-status-success mt-0.5 shrink-0" />
                      ) : (
                        <div className="w-4 h-4 rounded-full border border-text-muted mt-0.5 shrink-0" />
                      )}
                      <span className="text-text-secondary">
                        {key === 'users' ? `Up to ${value} team members` : FEATURE_LABELS[key] || String(value)}
                      </span>
                    </li>
                  ))}
                </ul>

                <Button
                  className="w-full"
                  variant={isCurrent ? 'outline' : 'default'}
                  disabled={isCurrent || checkoutLoading}
                  onClick={() => handleUpgrade(planKey)}
                >
                  {isCurrent ? 'Current Plan' : 'Upgrade'}
                </Button>
              </CardContent>
            </Card>
          )
        })}
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Billing History</CardTitle>
          <CardDescription>View your past invoices and payments</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="text-center py-8">
            <CreditCard className="w-12 h-12 text-text-muted mx-auto mb-3" />
            <p className="text-text-secondary">No billing history yet</p>
            <p className="text-xs text-text-muted mt-1">
              Invoices will appear here after your first payment
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
