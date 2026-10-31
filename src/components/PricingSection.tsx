/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React from 'react';
import { motion } from 'motion/react';
import { Clock, Zap, Info, MessageSquare, ArrowRight } from 'lucide-react';
import { PRICING_PLANS } from '../data/mockData';
import { PricingPlan } from '../types';

interface PricingSectionProps {
  onSelectPlan?: (plan: PricingPlan) => void;
  onCustomQuote?: () => void;
}

export const PricingSection: React.FC<PricingSectionProps> = ({ onSelectPlan, onCustomQuote }) => {
  const handlePlanClick = (plan: PricingPlan) => {
    if (onSelectPlan) {
      onSelectPlan(plan);
    }
    window.dispatchEvent(
      new CustomEvent('metaresolve_open_chat', {
        detail: {
          platform: plan.platform,
        },
      })
    );
  };

  const handleCaseTicketClick = (plan: PricingPlan) => {
    if (onSelectPlan) {
      onSelectPlan(plan);
    }
    const contactEl = document.getElementById('contact');
    if (contactEl) {
      contactEl.scrollIntoView({ behavior: 'smooth' });
    }
  };

  return (
    <section className="py-20 lg:py-28 bg-[#090D0D] relative overflow-hidden" id="pricing">
      {/* Background ambient lighting */}
      <div className="absolute top-1/4 left-1/2 -translate-x-1/2 w-[750px] h-[550px] bg-[#B7FF35]/[0.03] blur-[160px] pointer-events-none" />
      <div className="absolute bottom-10 right-10 w-[450px] h-[450px] bg-[#00E5FF]/[0.02] blur-[140px] pointer-events-none" />

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 relative z-10">
        
        {/* Section Header */}
        <div className="text-center max-w-2xl mx-auto mb-14 lg:mb-16">
          <div className="inline-flex items-center gap-2 px-3.5 py-1 rounded-full bg-[#141A19] border border-[#B7FF35]/30 mb-4">
            <span className="w-1.5 h-1.5 rounded-full bg-[#B7FF35]" />
            <span className="text-[11px] font-bold uppercase tracking-widest text-[#B7FF35] font-mono">
              TRANSPARENT PRICING
            </span>
          </div>

          <h2 className="text-3xl sm:text-4xl lg:text-5xl font-extrabold text-[#F2F5EF] tracking-tight leading-tight font-display">
            No guesswork. Know what<br />
            <span className="text-[#B7FF35]">you pay.</span>
          </h2>

          <p className="text-sm sm:text-base text-[#8C9891] mt-4 leading-relaxed">
            Professional casework and strategic resolution with clear pricing per recovery scope. No surprise fees, no subscriptions.
          </p>
        </div>

        {/* 3-Column Responsive Grid on Desktop / 1-Column on Mobile */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 lg:gap-6 mb-8">
          {PRICING_PLANS.map((plan, idx) => {
            const isPopular = plan.isPopular;

            return (
              <motion.div
                key={plan.id}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ duration: 0.4, delay: idx * 0.05 }}
                whileHover={{ y: -5 }}
                className={`relative rounded-[16px] flex flex-col justify-between transition-all duration-300 group p-6 ${
                  isPopular
                    ? 'bg-[#101917] border border-[#B7FF35]/70 shadow-[0_0_30px_rgba(183,255,53,0.15)] hover:border-[#B7FF35] hover:shadow-[0_0_40px_rgba(183,255,53,0.25)]'
                    : 'bg-[#0E1514] border border-white/[0.08] hover:border-[#B7FF35]/40 hover:shadow-2xl hover:shadow-black/60'
                }`}
              >
                {/* ⚡ MOST POPULAR Badge for Card 2 */}
                {isPopular && (
                  <div className="absolute -top-3.5 left-1/2 -translate-x-1/2 px-4 py-1 rounded-full bg-[#B7FF35] text-[#090D0D] font-mono text-[11px] font-extrabold tracking-wider uppercase shadow-[0_0_15px_rgba(183,255,53,0.4)] flex items-center gap-1">
                    <Zap className="w-3 h-3 fill-current" />
                    <span>MOST POPULAR</span>
                  </div>
                )}

                <div>
                  {/* 1. Platform / Category Label */}
                  <div className="text-[11px] font-mono font-bold tracking-wider text-[#B7FF35] uppercase mb-2">
                    {plan.categoryLabel || plan.platform.toUpperCase()}
                  </div>

                  {/* 2. Service Name */}
                  <h3 className="text-xl font-bold text-white tracking-tight mb-3 group-hover:text-white transition-colors">
                    {plan.title}
                  </h3>

                  {/* 3. Price & Flat indicator */}
                  <div className="flex items-baseline gap-2 mb-3">
                    <span className="text-3xl sm:text-4xl font-extrabold text-[#B7FF35] font-mono tracking-tight">
                      {plan.price}
                    </span>
                    {plan.isFlat && (
                      <span className="text-xs font-mono text-[#8C9891] lowercase">
                        flat
                      </span>
                    )}
                  </div>

                  {/* 4. Turnaround Time */}
                  <div className="flex items-center gap-1.5 text-xs text-[#8C9891] font-mono mb-4">
                    <Clock className="w-3.5 h-3.5 text-[#B7FF35] shrink-0" />
                    <span>Estimated time: <strong className="text-[#D1DDD6] font-semibold">{plan.turnaround}</strong></span>
                  </div>

                  {/* 5. Service Description */}
                  <p className="text-xs sm:text-sm text-[#8C9891] leading-relaxed mb-5 min-h-[44px]">
                    {plan.description}
                  </p>

                  {/* 6. Highlighted Information Box */}
                  {plan.infoBox && (
                    <div className="bg-[#121B19] border border-white/[0.06] rounded-xl px-3.5 py-2.5 mb-5 text-[11px] text-[#A6B5AD] leading-snug font-medium">
                      {plan.infoBox}
                    </div>
                  )}
                </div>

                {/* 7. Action Area: Primary CTA & Intake Options */}
                <div className="space-y-2 pt-2 border-t border-white/[0.05]">
                  <motion.button
                    type="button"
                    whileHover={{ y: -2, scale: 1.01 }}
                    whileTap={{ scale: 0.98 }}
                    onClick={() => handlePlanClick(plan)}
                    className={`w-full py-3.5 px-4 rounded-xl text-sm font-bold tracking-wide transition-all duration-200 flex items-center justify-center gap-2 cursor-pointer shadow-md ${
                      isPopular
                        ? 'bg-gradient-to-r from-[#A3F226] via-[#B7FF35] to-[#C8FF52] hover:from-[#B7FF35] hover:to-[#D5FF6E] text-[#090D0D] shadow-[0_0_20px_rgba(183,255,53,0.3)] hover:shadow-[0_0_30px_rgba(183,255,53,0.5)]'
                        : 'bg-[#14201C] hover:bg-[#1A2A25] text-white hover:text-[#B7FF35] border border-white/10 hover:border-[#B7FF35]/40 hover:shadow-[0_0_15px_rgba(183,255,53,0.15)]'
                    }`}
                  >
                    <span>{plan.ctaText || 'Get Started →'}</span>
                  </motion.button>

                  {/* Quick Support & Intake Options */}
                  <div className="grid grid-cols-2 gap-2 pt-1">
                    <motion.button
                      type="button"
                      whileHover={{ scale: 1.02, y: -1 }}
                      whileTap={{ scale: 0.97 }}
                      onClick={() => handlePlanClick(plan)}
                      className="py-1.5 px-2 rounded-lg bg-black/40 hover:bg-[#B7FF35]/15 border border-white/[0.06] hover:border-[#B7FF35]/30 text-[11px] font-mono text-[#A0AAA3] hover:text-[#B7FF35] flex items-center justify-center gap-1.5 transition-colors cursor-pointer"
                      title="Open Support Chat"
                    >
                      <MessageSquare className="w-3 h-3 text-[#B7FF35]" />
                      <span>Live Chat</span>
                    </motion.button>

                    <motion.button
                      type="button"
                      whileHover={{ scale: 1.02, y: -1 }}
                      whileTap={{ scale: 0.97 }}
                      onClick={() => handleCaseTicketClick(plan)}
                      className="py-1.5 px-2 rounded-lg bg-black/40 hover:bg-[#B7FF35]/15 border border-white/[0.06] hover:border-[#B7FF35]/30 text-[11px] font-mono text-[#A0AAA3] hover:text-[#B7FF35] flex items-center justify-center gap-1 transition-colors cursor-pointer"
                      title="Submit Ticket Form"
                    >
                      <ArrowRight className="w-3 h-3 text-[#B7FF35]" />
                      <span>Intake Ticket</span>
                    </motion.button>
                  </div>
                </div>
              </motion.div>
            );
          })}
        </div>

        {/* Pricing Disclaimer */}
        <div className="text-center max-w-3xl mx-auto mt-6 mb-4 px-4">
          <p className="text-xs text-[#738279] leading-relaxed flex items-center justify-center gap-2">
            <Info className="w-3.5 h-3.5 text-[#8C9891] shrink-0 hidden sm:inline" />
            <span>
              Prices are indicative and may vary depending on the platform, account type, case complexity, and required recovery process. Final pricing will be confirmed after case review.
            </span>
          </p>
        </div>

      </div>
    </section>
  );
};
