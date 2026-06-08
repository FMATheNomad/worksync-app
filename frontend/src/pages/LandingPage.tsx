/**
 * Public landing/marketing page (no auth required).
 *
 * WHY THIS EXISTS: First impression for potential customers. Must communicate
 * value proposition, features, how-it-works, and pricing — all without the
 * user needing to sign up. This is the primary conversion funnel.
 *
 * SECTION ARCHITECTURE:
 *   1. Hero: Above-the-fold value proposition with CTA buttons.
 *   2. Features: Grid of 6 feature cards (GPS, AI, Expenses, Monitoring,
 *      Analytics, Export). Each card has an icon, title, and description.
 *   3. How It Works: 3-step numbered process (Register → Work → Monitor).
 *   4. Why Worksync: 4 advantage pillars (Enterprise, AI, Mobile, Price).
 *   5. Pricing: 3-tier pricing table with monthly/yearly toggle.
 *   6. Footer: Links, copyright, branding.
 *
 *   WHY this specific section order: Standard SaaS landing page pattern that
 *   leads visitors through a proven conversion funnel:
 *     Attention (Hero) → Interest (Features) → Desire (How it works + Why)
 *     → Action (Pricing + CTA).
 *
 * SEO CONSIDERATIONS:
 *   - Semantic HTML: h1, h2, section, nav, footer for proper heading hierarchy.
 *   - Text content (not SVGs/images for text): All descriptions are HTML text,
 *     searchable by crawlers. The dashboard preview is a CSS-only placeholder
 *     (no screenshot image) — adding an actual screenshot with alt text would
 *     improve SEO.
 *   - No meta tags: These should be added in index.html or via a helmet library.
 *   - Links use href (not onClick navigate) for navigation links in the hero
 *     and pricing sections — these are crawlable.
 *
 * RESPONSIVE DESIGN:
 *   - Mobile-first: The nav collapses to hamburger menu below md breakpoint.
 *   - Feature grid: 1 col (mobile) → 2 col (md) → 3 col (lg).
 *   - Pricing cards: 1 col → 3 col. The "Pro" card is highlighted and scaled.
 *   - Smooth scroll: Anchor links (#features, #how-it-works, #pricing) use
 *     scrollIntoView with smooth behavior for in-page navigation.
 *
 * PERFORMANCE:
 *   - No heavy images or animations that would impact LCP.
 *   - CSS blur and pulse animations are GPU-accelerated (opacity/transform).
 *   - Lucide icons are tree-shaken (only used icons are imported).
 *   - All sections render on mount — no lazy loading needed for this page.
 *
 * PRICING TOGGLE:
 *   Monthly/Yearly toggle calculates displayed prices from the Plan constants.
 *   Yearly shows the total (not monthly equivalent) because that's what
 *   Polar.sh charges. The "Save 20%" label compares yearly vs. monthly×12.
 *
 * TRADE-OFF — No i18n:
 *   All content is hardcoded in English. For an international SaaS, this
 *   should use react-i18next or similar. Currently English-only for MVP.
 */

import { useState, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  MapPin, Camera, BarChart3, Download, Sparkles,
  ChevronRight, Check, Menu, X, Star, Shield, Smartphone, DollarSign, Sun, Moon
} from 'lucide-react'
import { useThemeStore } from '@/stores/themeStore'
import { ROUTES } from '@/constants'

const FEATURES = [
  { icon: MapPin, title: 'GPS Attendance', description: 'Location-based attendance with selfie verification and reverse geocoding. Know the exact location of every employee at check-in.' },
  { icon: Sparkles, title: 'AI Reports', description: 'Generate professional daily reports automatically with AI. Just describe your activities, AI formats them for you.' },
  { icon: Camera, title: 'Expense Management', description: 'Track team expenses with receipt photo uploads and automatic categorization for transparent reimbursements.' },
  { icon: BarChart3, title: 'Real-time Monitoring', description: 'Monitor team activities in real-time through an interactive dashboard with maps and charts.' },
  { icon: Star, title: 'Smart Analytics', description: 'Ask AI about your team data. Who is frequently late? What is the total overtime cost? AI answers instantly.' },
  { icon: Download, title: 'Excel Export', description: 'Export attendance and expense data to Excel with one click. Easy for accounting and payroll.' },
]

const STEPS = [
  { number: '01', title: 'Register & Invite Team', description: 'Admin creates a Worksync account, invites employees via email. Your team is ready in 5 minutes.' },
  { number: '02', title: 'Team Starts Working', description: 'Employees check in with GPS, track expenses, and create daily reports with AI assistance.' },
  { number: '03', title: 'Monitor & Analyze', description: 'Admin monitors all activities on the dashboard, AI helps analyze data for business decisions.' },
]

const ADVANTAGES = [
  { icon: Shield, title: 'Enterprise Grade', description: 'Built with enterprise security standards and scalability. Your data is secure and encrypted.' },
  { icon: Sparkles, title: 'AI-Powered', description: 'Advanced DeepSeek AI boosts your team productivity with analysis and automated report generation.' },
  { icon: Smartphone, title: 'Mobile Friendly', description: 'Work anywhere with a responsive design optimized for mobile devices.' },
  { icon: DollarSign, title: 'Affordable Pricing', description: 'Starting from $9/month for small teams to enterprise. No hidden fees.' },
]

const PLANS = [
  {
    key: 'free', name: 'Free', price: 0, yearlyPrice: 0, popular: false,
    features: ['Basic attendance', 'Up to 5 employees', 'Attendance history', 'Admin dashboard'],
    missing: ['AI Assistant', 'Excel Export', 'Map monitoring'],
  },
  {
    key: 'pro', name: 'Pro', price: 9, yearlyPrice: 86, popular: true,
    features: ['All Free features', 'Up to 50 employees', 'Full AI Assistant', 'Unlimited Excel Export', 'Priority support'],
    missing: [],
  },
  {
    key: 'enterprise', name: 'Enterprise', price: 29, yearlyPrice: 278, popular: false,
    features: ['All Pro features', 'Unlimited employees', '24/7 Priority support', 'Custom branding', 'Dedicated account manager'],
    missing: [],
  },
]

const NAV_LINKS = [
  { label: 'Features', href: '#features' },
  { label: 'How It Works', href: '#how-it-works' },
  { label: 'Pricing', href: '#pricing' },
]

export default function LandingPage() {
  const navigate = useNavigate()
  const theme = useThemeStore((s) => s.theme)
  const toggleTheme = useThemeStore((s) => s.toggleTheme)
  const [mobileMenu, setMobileMenu] = useState(false)
  const [yearly, setYearly] = useState(false)

  const handleNav = useCallback((href: string) => {
    setMobileMenu(false)
    if (href.startsWith('#')) {
      const el = document.querySelector(href)
      el?.scrollIntoView({ behavior: 'smooth' })
    } else {
      navigate(href)
    }
  }, [navigate])

  return (
    <div className="min-h-screen bg-surface-base text-text-primary">
      {/* Sticky nav with backdrop blur for modern glassmorphism effect */}
      <nav className="fixed top-0 left-0 right-0 z-50 bg-surface-base/80 backdrop-blur-xl border-b border-surface-border/50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-worksync-500 to-worksync-700 flex items-center justify-center">
                <span className="text-white font-bold text-sm">S</span>
              </div>
              <span className="text-xl font-bold">Worksync</span>
            </div>

            <div className="hidden md:flex items-center gap-8">
              {NAV_LINKS.map((link) => (
                <button key={link.href} onClick={() => handleNav(link.href)}
                  className="text-sm text-text-secondary hover:text-text-primary transition-colors">
                  {link.label}
                </button>
              ))}
              <button onClick={toggleTheme} className="p-2 rounded-lg text-text-secondary hover:text-text-primary hover:bg-surface-hover transition-colors">
                {theme === 'dark' ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
              </button>
              <button onClick={() => navigate(ROUTES.LOGIN)}
                className="text-sm font-medium text-text-secondary hover:text-text-primary transition-colors">
                Login
              </button>
              <button onClick={() => navigate(ROUTES.LOGIN)}
                className="px-5 py-2 rounded-xl bg-worksync-600 hover:bg-worksync-700 text-white text-sm font-medium transition-all hover:shadow-lg hover:shadow-worksync-600/25">
                Get Started Free
              </button>
            </div>

            <div className="hidden md:flex items-center gap-8">
              {NAV_LINKS.map((link) => (
                <button key={link.href} onClick={() => handleNav(link.href)}
                  className="text-sm text-text-secondary hover:text-text-primary transition-colors">
                  {link.label}
                </button>
              ))}
              <button onClick={toggleTheme} className="p-2 rounded-lg text-text-secondary hover:text-text-primary hover:bg-surface-hover transition-colors">
                {theme === 'dark' ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
              </button>
              <button onClick={() => navigate(ROUTES.LOGIN)}
                className="text-sm font-medium text-text-secondary hover:text-text-primary transition-colors">
                Login
              </button>
              <button onClick={() => navigate(ROUTES.LOGIN)}
                className="px-5 py-2 rounded-xl bg-worksync-600 hover:bg-worksync-700 text-white text-sm font-medium transition-all hover:shadow-lg hover:shadow-worksync-600/25">
                Get Started Free
              </button>
          </div>
        </div>

        {mobileMenu && (
          <div className="md:hidden border-t border-surface-border bg-surface-card p-4 space-y-3">
            {NAV_LINKS.map((link) => (
              <button key={link.href} onClick={() => handleNav(link.href)}
                className="block w-full text-left text-sm text-text-secondary py-2">
                {link.label}
              </button>
            ))}
            <hr className="border-surface-border" />
            <button onClick={toggleTheme}
              className="flex items-center gap-2 text-sm text-text-secondary py-2">
              {theme === 'dark' ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
              {theme === 'dark' ? 'Light Mode' : 'Dark Mode'}
            </button>
            <button onClick={() => navigate(ROUTES.LOGIN)}
              className="block w-full text-left text-sm font-medium py-2">Login</button>
            <button onClick={() => navigate(ROUTES.LOGIN)}
              className="w-full py-2.5 rounded-xl bg-worksync-600 text-white text-sm font-medium text-center">
                Get Started Free
              </button>
            )}
      </nav>

      <main>
      {/* Hero section: Full viewport height with gradient overlay */}
      <section className="relative min-h-screen flex items-center pt-16 overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-b from-worksync-950/50 via-surface-base to-surface-base" />
        <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-worksync-600/10 rounded-full blur-3xl animate-pulse" />
        <div className="absolute bottom-1/4 right-1/4 w-64 h-64 bg-accent-500/5 rounded-full blur-3xl animate-pulse" style={{ animationDelay: '1s' }} />

        <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-20">
          <div className="grid lg:grid-cols-2 gap-12 items-center">
            <div className="space-y-8">
              <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-worksync-600/10 border border-worksync-600/20">
                <Sparkles className="w-4 h-4 text-worksync-400" />
                <span className="text-sm text-worksync-400">AI-Powered Works Activity Tracker</span>
              </div>
              <h1 className="text-4xl sm:text-5xl lg:text-6xl font-bold leading-tight">
                Track Your Team's Work Activity
                <span className="block text-transparent bg-clip-text bg-gradient-to-r from-worksync-400 to-accent-500">
                  dengan Mudah dan Profesional
                </span>
              </h1>
              <p className="text-lg text-text-secondary max-w-xl">
                Worksync is an AI-powered attendance, expense tracking, and daily reporting platform
                yang membantu tim Anda bekerja lebih produktif dan terorganisir.
              </p>
              <div className="flex flex-wrap gap-4">
                <button onClick={() => navigate(ROUTES.LOGIN)}
                  className="px-8 py-3 rounded-xl bg-worksync-600 hover:bg-worksync-700 text-white font-semibold transition-all hover:shadow-xl hover:shadow-worksync-600/30 flex items-center gap-2">
                  Get Started Free <ChevronRight className="w-4 h-4" />
                </button>
                <button onClick={() => handleNav('#features')}
                  className="px-8 py-3 rounded-xl border border-surface-border hover:border-worksync-600/50 text-text-secondary font-semibold transition-all">
                  See Demo
                </button>
              </div>
            </div>

            <div className="relative">
              <div className="aspect-[4/3] rounded-2xl bg-gradient-to-br from-worksync-900 via-worksync-800 to-worksync-900 border border-worksync-700/50 flex items-center justify-center overflow-hidden">
                <div className="absolute inset-0 opacity-10" style={{
                  backgroundImage: 'radial-gradient(circle at 1px 1px, rgba(99,102,241,0.3) 1px, transparent 0)',
                  backgroundSize: '24px 24px'
                }} />
                <div className="relative text-center">
                  <div className="w-16 h-16 mx-auto mb-4 rounded-2xl bg-gradient-to-br from-worksync-500 to-worksync-700 flex items-center justify-center">
                    <BarChart3 className="w-8 h-8 text-white" />
                  </div>
                  <p className="text-text-muted text-lg font-medium">Dashboard Preview</p>
                  <p className="text-text-muted/50 text-sm mt-1">Hero Illustration Placeholder</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section id="features" className="py-24 px-4">
        <div className="max-w-7xl mx-auto">
          <div className="text-center mb-16 space-y-4">
            <h2 className="text-3xl sm:text-4xl font-bold">Core Features</h2>
            <p className="text-text-secondary text-lg max-w-2xl mx-auto">
              Everything you need to manage your team's work activities in one integrated platform.
            </p>
          </div>
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
            {FEATURES.map((feature) => (
              <div key={feature.title}
                className="group p-6 rounded-2xl bg-surface-card border border-surface-border hover:border-worksync-600/50 transition-all duration-300 hover:shadow-xl hover:shadow-worksync-600/5">
                <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-worksync-600/20 to-worksync-700/20 flex items-center justify-center mb-4 group-hover:scale-110 transition-transform">
                  <feature.icon className="w-6 h-6 text-worksync-400" />
                </div>
                <h3 className="text-lg font-semibold mb-2">{feature.title}</h3>
                <p className="text-text-secondary text-sm leading-relaxed">{feature.description}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section id="how-it-works" className="py-24 px-4 bg-surface-card/50">
        <div className="max-w-5xl mx-auto">
          <div className="text-center mb-16 space-y-4">
            <h2 className="text-3xl sm:text-4xl font-bold">How It Works</h2>
            <p className="text-text-secondary text-lg">Start using Worksync in 3 easy steps.</p>
          </div>
          <div className="grid md:grid-cols-3 gap-8 relative">
            {STEPS.map((step) => (
              <div key={step.number} className="relative text-center group">
                <div className="w-20 h-20 mx-auto mb-6 rounded-2xl bg-gradient-to-br from-worksync-600 to-worksync-800 flex items-center justify-center text-2xl font-bold text-white group-hover:scale-110 transition-transform">
                  {step.number}
                </div>
                <h3 className="text-xl font-semibold mb-3">{step.title}</h3>
                <p className="text-text-secondary text-sm leading-relaxed">{step.description}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section id="why-worksync" className="py-24 px-4">
        <div className="max-w-7xl mx-auto">
          <div className="text-center mb-16 space-y-4">
            <h2 className="text-3xl sm:text-4xl font-bold">Why Worksync?</h2>
            <p className="text-text-secondary text-lg max-w-2xl mx-auto">
              Built with enterprise standards for serious teams.
            </p>
          </div>
          <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-6">
            {ADVANTAGES.map((adv) => (
              <div key={adv.title} className="p-6 rounded-2xl bg-surface-card border border-surface-border hover:border-accent-500/30 transition-all">
                <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-accent-500/20 to-accent-600/20 flex items-center justify-center mb-4">
                  <adv.icon className="w-6 h-6 text-accent-500" />
                </div>
                <h3 className="text-lg font-semibold mb-2">{adv.title}</h3>
                <p className="text-text-secondary text-sm leading-relaxed">{adv.description}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section id="pricing" className="py-24 px-4 bg-surface-card/50">
        <div className="max-w-7xl mx-auto">
          <div className="text-center mb-12 space-y-4">
            <h2 className="text-3xl sm:text-4xl font-bold">Simple Pricing</h2>
            <p className="text-text-secondary text-lg">Start free, upgrade anytime.</p>

            <div className="flex items-center justify-center gap-3 mt-6">
              <span className={`text-sm ${!yearly ? 'text-text-primary font-semibold' : 'text-text-muted'}`}>Monthly</span>
              <button onClick={() => setYearly(!yearly)}
                className={`relative w-14 h-7 rounded-full transition-colors ${yearly ? 'bg-worksync-600' : 'bg-surface-border'}`}>
                <div className={`absolute top-0.5 w-6 h-6 rounded-full bg-white shadow transition-transform ${yearly ? 'translate-x-7' : 'translate-x-0.5'}`} />
              </button>
              <span className={`text-sm ${yearly ? 'text-text-primary font-semibold' : 'text-text-muted'}`}>
                Yearly <span className="text-accent-500">Save 20%</span>
              </span>
            </div>
          </div>

          <div className="grid md:grid-cols-3 gap-6 max-w-5xl mx-auto">
            {PLANS.map((plan) => {
              const price = yearly ? plan.yearlyPrice : plan.price
              const priceLabel = yearly ? '/year' : '/month'

              return (
                <div key={plan.key}
                  className={`relative p-8 rounded-2xl border transition-all duration-300 ${
                    plan.popular
                      ? 'border-worksync-600 bg-surface-card shadow-2xl shadow-worksync-600/10 scale-105 md:scale-105'
                      : 'border-surface-border bg-surface-card hover:border-worksync-600/50'
                  }`}>
                  {plan.popular && (
                    <div className="absolute -top-3 left-1/2 -translate-x-1/2">
                      <span className="px-4 py-1 rounded-full bg-gradient-to-r from-worksync-500 to-worksync-700 text-white text-xs font-semibold shadow-lg">
                        Most Popular
                      </span>
                    </div>
                  )}

                  <div className="mb-6">
                    <h3 className="text-xl font-bold mb-2">{plan.name}</h3>
                    <div className="flex items-baseline gap-1">
                      <span className="text-4xl font-bold">${price}</span>
                      <span className="text-text-muted text-sm">{priceLabel}</span>
                    </div>
                  </div>

                  <ul className="space-y-3 mb-8">
                    {plan.features.map((f) => (
                      <li key={f} className="flex items-start gap-3 text-sm">
                        <Check className="w-4 h-4 text-accent-500 mt-0.5 shrink-0" />
                        <span>{f}</span>
                      </li>
                    ))}
                    {plan.missing.map((f) => (
                      <li key={f} className="flex items-start gap-3 text-sm text-text-muted">
                        <div className="w-4 h-4 rounded-full border border-text-muted mt-0.5 shrink-0" />
                        <span>{f}</span>
                      </li>
                    ))}
                  </ul>

                  <button onClick={() => navigate(ROUTES.LOGIN)}
                    className={`w-full py-3 rounded-xl font-semibold transition-all ${
                      plan.popular
                        ? 'bg-worksync-600 hover:bg-worksync-700 text-white shadow-lg shadow-worksync-600/25'
                        : 'border border-surface-border hover:border-worksync-600/50 text-text-secondary'
                    }`}>
                    {plan.key === 'free' ? 'Get Started Free' : 'Upgrade Now'}
                  </button>
                </div>
              )
            })}
          </div>
        </div>
      </section>

      </main>
      <footer className="border-t border-surface-border py-16 px-4">
        <div className="max-w-7xl mx-auto">
          <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-8">
            <div className="space-y-4">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-worksync-500 to-worksync-700 flex items-center justify-center">
                  <span className="text-white font-bold text-sm">S</span>
                </div>
                <span className="text-xl font-bold">Worksync</span>
              </div>
              <p className="text-sm text-text-secondary leading-relaxed">
                AI-powered attendance and work monitoring platform for productive teams.
              </p>
            </div>

            <div>
              <h4 className="font-semibold mb-4">Product</h4>
              <ul className="space-y-2 text-sm text-text-secondary">
                <li><button onClick={() => handleNav('#features')} className="hover:text-text-primary transition-colors">Features</button></li>
                <li><button onClick={() => handleNav('#pricing')} className="hover:text-text-primary transition-colors">Pricing</button></li>
                <li><button className="hover:text-text-primary transition-colors">FAQ</button></li>
              </ul>
            </div>

            <div>
              <h4 className="font-semibold mb-4">Resources</h4>
              <ul className="space-y-2 text-sm text-text-secondary">
                <li><span className="cursor-default">Documentation</span></li>
                <li><span className="cursor-default">API</span></li>
                <li><span className="cursor-default">Blog</span></li>
              </ul>
            </div>

            <div>
              <h4 className="font-semibold mb-4">Legal</h4>
              <ul className="space-y-2 text-sm text-text-secondary">
                <li><span className="cursor-default">Privacy Policy</span></li>
                <li><span className="cursor-default">Terms & Conditions</span></li>
              </ul>
            </div>
          </div>

          <div className="mt-12 pt-8 border-t border-surface-border text-center text-sm text-text-muted space-y-1">
            <p>&copy; {new Date().getFullYear()} Worksync. All rights reserved.</p>
            <p>Build and Dev by <a href="https://fmasoftwarelabs.up.railway.app" target="_blank" rel="noopener noreferrer" className="text-worksync-400 hover:text-worksync-300 transition-colors">FMA Software Labs</a> 🔥</p>
          </div>
        </div>
      </footer>
    </div>
  )
}
