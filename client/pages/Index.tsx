import { Link } from "react-router-dom";
import Layout from "@/components/Layout";
import { ArrowRight, TrendingUp, Shield, Zap, Users, DollarSign, Cpu } from "lucide-react";

export default function Index() {
  return (
    <Layout>
      {/* Premium Hero Section - Compact */}
      <section className="relative overflow-hidden">
        <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10 md:py-16">
          <div className="text-center">
            <h1 className="text-4xl md:text-5xl font-black text-white tracking-tight mb-3 leading-tight">
              Grow Your Mining Power.
            </h1>
            <p className="text-base md:text-lg text-[#A7B0BB] max-w-2xl mx-auto mb-6 leading-relaxed">
              Your mining runs 24/7, generating reliable automated income.
            </p>
            <div className="flex flex-col sm:flex-row gap-3 justify-center items-center max-w-md mx-auto">
              <Link
                to="/register"
                className="w-full sm:w-auto inline-flex items-center justify-center px-6 py-3 bg-[#F0B90B] hover:brightness-110 text-[#12161C] font-semibold rounded-lg transition-all duration-200"
              >
                Get Started <ArrowRight className="ml-2" size={18} />
              </Link>
              <a
                href="#how-it-works"
                className="w-full sm:w-auto inline-flex items-center justify-center px-6 py-3 border border-[#F0B90B] text-[#F0B90B] hover:bg-[#F0B90B]/10 font-semibold rounded-lg transition-all duration-200"
              >
                Learn More
              </a>
            </div>
          </div>
        </div>
      </section>

      {/* Features Grid - Compact */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 md:py-10">
        <div className="text-center mb-6">
          <h2 className="text-2xl md:text-3xl font-bold mb-2">Why Globance?</h2>
          <p className="text-[#A7B0BB] text-sm">
            A high-performance cloud mining platform built for serious miners
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {/* Feature 1 */}
          <div className="bg-[#2B3139] border border-white/5 rounded-xl p-4 hover:border-[#F0B90B]/30 transition-colors">
            <div className="w-10 h-10 bg-[#F0B90B]/20 rounded-lg flex items-center justify-center mb-3">
              <Zap className="text-[#F0B90B]" size={20} />
            </div>
            <h3 className="text-lg font-bold mb-2">Instant Activation</h3>
            <p className="text-[#A7B0BB] text-sm mb-3">
              Activate your mining power instantly. No hardware needed.
            </p>
            <ul className="space-y-1.5 text-xs text-[#A7B0BB]">
              <li className="flex items-center gap-2">
                <span className="w-1 h-1 bg-[#F0B90B] rounded-full" />
                <span>6 mining packages available</span>
              </li>
              <li className="flex items-center gap-2">
                <span className="w-1 h-1 bg-[#F0B90B] rounded-full" />
                <span>Mining starts immediately</span>
              </li>
              <li className="flex items-center gap-2">
                <span className="w-1 h-1 bg-[#F0B90B] rounded-full" />
                <span>No technical setup required</span>
              </li>
            </ul>
          </div>

          {/* Feature 2 */}
          <div className="bg-[#2B3139] border border-white/5 rounded-xl p-4 hover:border-[#F0B90B]/30 transition-colors">
            <div className="w-10 h-10 bg-[#F0B90B]/20 rounded-lg flex items-center justify-center mb-3">
              <TrendingUp className="text-[#F0B90B]" size={20} />
            </div>
            <h3 className="text-lg font-bold mb-2">Daily Rewards</h3>
            <p className="text-[#A7B0BB] text-sm mb-3">
              Earn daily USDT rewards automatically.
            </p>
            <ul className="space-y-1.5 text-xs text-[#A7B0BB]">
              <li className="flex items-center gap-2">
                <span className="w-1 h-1 bg-[#F0B90B] rounded-full" />
                <span>2.5% - 3.0% daily returns</span>
              </li>
              <li className="flex items-center gap-2">
                <span className="w-1 h-1 bg-[#F0B90B] rounded-full" />
                <span>Automatic daily distribution</span>
              </li>
              <li className="flex items-center gap-2">
                <span className="w-1 h-1 bg-[#F0B90B] rounded-full" />
                <span>270-day mining period</span>
              </li>
            </ul>
          </div>

          {/* Feature 3 */}
          <div className="bg-[#2B3139] border border-white/5 rounded-xl p-4 hover:border-[#F0B90B]/30 transition-colors">
            <div className="w-10 h-10 bg-[#F0B90B]/20 rounded-lg flex items-center justify-center mb-3">
              <Shield className="text-[#F0B90B]" size={20} />
            </div>
            <h3 className="text-lg font-bold mb-2">Security First</h3>
            <p className="text-[#A7B0BB] text-sm mb-3">
              Your funds are protected with enterprise security.
            </p>
            <ul className="space-y-1.5 text-xs text-[#A7B0BB]">
              <li className="flex items-center gap-2">
                <span className="w-1 h-1 bg-[#F0B90B] rounded-full" />
                <span>Permanent deposit addresses</span>
              </li>
              <li className="flex items-center gap-2">
                <span className="w-1 h-1 bg-[#F0B90B] rounded-full" />
                <span>Secure blockchain verification</span>
              </li>
              <li className="flex items-center gap-2">
                <span className="w-1 h-1 bg-[#F0B90B] rounded-full" />
                <span>Authenticated withdrawals</span>
              </li>
            </ul>
          </div>

          {/* Feature 4 */}
          <div className="bg-[#2B3139] border border-white/5 rounded-xl p-4 hover:border-[#F0B90B]/30 transition-colors">
            <div className="w-10 h-10 bg-[#F0B90B]/20 rounded-lg flex items-center justify-center mb-3">
              <DollarSign className="text-[#F0B90B]" size={20} />
            </div>
            <h3 className="text-lg font-bold mb-2">Fast Withdrawals</h3>
            <p className="text-[#A7B0BB] text-sm mb-3">
              Withdraw your earnings anytime.
            </p>
            <ul className="space-y-1.5 text-xs text-[#A7B0BB]">
              <li className="flex items-center gap-2">
                <span className="w-1 h-1 bg-[#F0B90B] rounded-full" />
                <span>5 USDT minimum withdrawal</span>
              </li>
              <li className="flex items-center gap-2">
                <span className="w-1 h-1 bg-[#F0B90B] rounded-full" />
                <span>TRC20 & BEP20 supported</span>
              </li>
              <li className="flex items-center gap-2">
                <span className="w-1 h-1 bg-[#F0B90B] rounded-full" />
                <span>Fast processing</span>
              </li>
            </ul>
          </div>

          {/* Feature 5 */}
          <div className="bg-[#2B3139] border border-white/5 rounded-xl p-4 hover:border-[#F0B90B]/30 transition-colors">
            <div className="w-10 h-10 bg-[#F0B90B]/20 rounded-lg flex items-center justify-center mb-3">
              <Users className="text-[#F0B90B]" size={20} />
            </div>
            <h3 className="text-lg font-bold mb-2">Referral Earnings</h3>
            <p className="text-[#A7B0BB] text-sm mb-3">
              Earn multi-level commissions.
            </p>
            <ul className="space-y-1.5 text-xs text-[#A7B0BB]">
              <li className="flex items-center gap-2">
                <span className="w-1 h-1 bg-[#F0B90B] rounded-full" />
                <span>3-level referral (10%, 3%, 2%)</span>
              </li>
              <li className="flex items-center gap-2">
                <span className="w-1 h-1 bg-[#F0B90B] rounded-full" />
                <span>Instant wallet credits</span>
              </li>
              <li className="flex items-center gap-2">
                <span className="w-1 h-1 bg-[#F0B90B] rounded-full" />
                <span>Earn from daily rewards</span>
              </li>
            </ul>
          </div>

          {/* Feature 6 */}
          <div className="bg-[#2B3139] border border-white/5 rounded-xl p-4 hover:border-[#F0B90B]/30 transition-colors">
            <div className="w-10 h-10 bg-[#F0B90B]/20 rounded-lg flex items-center justify-center mb-3">
              <Cpu className="text-[#F0B90B]" size={20} />
            </div>
            <h3 className="text-lg font-bold mb-2">24/7 Mining</h3>
            <p className="text-[#A7B0BB] text-sm mb-3">
              Non-stop cloud mining operations.
            </p>
            <ul className="space-y-1.5 text-xs text-[#A7B0BB]">
              <li className="flex items-center gap-2">
                <span className="w-1 h-1 bg-[#F0B90B] rounded-full" />
                <span>Always-on infrastructure</span>
              </li>
              <li className="flex items-center gap-2">
                <span className="w-1 h-1 bg-[#F0B90B] rounded-full" />
                <span>Automated daily payouts</span>
              </li>
              <li className="flex items-center gap-2">
                <span className="w-1 h-1 bg-[#F0B90B] rounded-full" />
                <span>Enterprise-grade uptime</span>
              </li>
            </ul>
          </div>
        </div>
      </section>

      {/* How It Works - Compact */}
      <section id="how-it-works" className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 md:py-10">
        <div className="bg-[#1E2329] border border-white/5 rounded-xl p-4 md:p-6">
          <div className="text-center mb-4">
            <h2 className="text-xl md:text-2xl font-bold mb-1">How It Works</h2>
            <p className="text-[#A7B0BB] text-sm">Start mining in 5 simple steps</p>
          </div>

          <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
            {[
              { num: "1", title: "Create Account", desc: "Sign up for free" },
              { num: "2", title: "Choose Package", desc: "Select your plan" },
              { num: "3", title: "Activate Mining", desc: "Start instantly" },
              { num: "4", title: "Earn Daily", desc: "Automatic rewards" },
              { num: "5", title: "Withdraw", desc: "Fast withdrawals" },
            ].map((step, idx) => (
              <div key={idx} className="text-center">
                <div className="w-8 h-8 bg-[#F0B90B] text-[#12161C] rounded-full flex items-center justify-center font-bold text-sm mx-auto mb-2">
                  {step.num}
                </div>
                <h3 className="text-sm font-bold mb-0.5">{step.title}</h3>
                <p className="text-[#6F7680] text-xs">{step.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Mining Packages Preview - Compact */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 md:py-10">
        <div className="text-center mb-5">
          <h2 className="text-xl md:text-2xl font-bold mb-1">Mining Packages</h2>
          <p className="text-[#A7B0BB] text-sm">Choose your power, earn every day</p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-3 mb-4">
          {[
            { name: "Bronze", desc: "Entry-level", min: "10 USDT", daily: "2.5%" },
            { name: "Silver", desc: "Stronger output", min: "100 USDT", daily: "2.6%" },
            { name: "Gold", desc: "Advanced power", min: "300 USDT", daily: "2.7%" },
          ].map((pkg) => (
            <div key={pkg.name} className="bg-[#2B3139] border border-white/5 rounded-xl p-4">
              <h3 className="text-lg font-bold mb-1">{pkg.name}</h3>
              <p className="text-[#6F7680] text-xs mb-3">{pkg.desc}</p>
              <div className="grid grid-cols-3 gap-2 mb-3 text-center">
                <div>
                  <p className="text-[#6F7680] text-xs">Min</p>
                  <p className="text-sm font-bold text-[#F0B90B]">{pkg.min}</p>
                </div>
                <div>
                  <p className="text-[#6F7680] text-xs">Daily</p>
                  <p className="text-sm font-bold">{pkg.daily}</p>
                </div>
                <div>
                  <p className="text-[#6F7680] text-xs">Duration</p>
                  <p className="text-sm font-bold">270 days</p>
                </div>
              </div>
              <Link
                to="/packages"
                className="w-full inline-block text-center px-3 py-2 bg-[#F0B90B]/20 text-[#F0B90B] font-medium text-sm rounded-lg hover:bg-[#F0B90B]/30 transition-colors"
              >
                View All Plans
              </Link>
            </div>
          ))}
        </div>

        <p className="text-center text-[#6F7680] text-xs">
          Platinum, Diamond, and Legendary packages available with up to 3.0% daily returns
        </p>
      </section>

      {/* CTA Section - Compact */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 md:py-8">
        <div className="bg-[#2B3139] border border-white/5 rounded-xl p-5 md:p-6 text-center">
          <h2 className="text-xl md:text-2xl font-bold mb-2">
            Ready to Start Mining?
          </h2>
          <p className="text-[#A7B0BB] text-sm mb-4 max-w-xl mx-auto">
            Join thousands of miners earning daily USDT rewards
          </p>
          <Link
            to="/register"
            className="inline-flex items-center justify-center px-6 py-2.5 bg-[#F0B90B] hover:brightness-110 text-[#12161C] font-semibold rounded-lg transition-all"
          >
            Create Account Now <ArrowRight className="ml-2" size={18} />
          </Link>
        </div>
      </section>
    </Layout>
  );
}
