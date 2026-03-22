import React, { useState } from 'react';
import { ChevronDown, HelpCircle } from 'lucide-react';
import { useSEO } from '../../hooks/useSEO';
import { faqItems, faqPage } from '../../content/publicContent';
import SupportRichText from '../common/SupportRichText';

const FAQView: React.FC = () => {
  useSEO({
    fullTitle: 'Crypto Trading FAQ | ZEROHUE',
    description: faqPage.description,
  });

  const [openIndex, setOpenIndex] = useState<number | null>(0);

  const toggleFAQ = (index: number) => {
    setOpenIndex(openIndex === index ? null : index);
  };

  return (
    <div className="space-y-8 pb-6">
      <header className="flex flex-col gap-2 mb-12 relative">
        <div className="absolute -top-10 -left-10 w-40 h-40 bg-blue-600/10 blur-[80px] rounded-full pointer-events-none" />
        <div className="flex items-center gap-4">
          <div className="p-3.5 bg-blue-600/10 rounded-2xl text-blue-400 border border-blue-500/20 shadow-lg shadow-blue-500/5">
            <HelpCircle size={28} />
          </div>
          <div>
            <h1 className="text-3xl font-black text-white tracking-tight uppercase">
              {faqPage.heading}
            </h1>
            <p className="text-slate-500 text-sm font-medium">{faqPage.subheading}</p>
          </div>
        </div>
      </header>

      <div className="flex flex-col lg:flex-row gap-8 w-full max-w-6xl mx-auto">
        {/* FAQ List */}
        <div className="flex-1 grid grid-cols-1 gap-4 h-fit">
          {faqItems.map((faq, index) => {
            const isOpen = openIndex === index;
            return (
              <div
                key={faq.question}
                className={`group relative rounded-[24px] transition-all duration-500 border ${
                  isOpen
                    ? 'bg-blue-600/5 border-blue-500/40 shadow-2xl shadow-blue-900/10'
                    : 'bg-slate-900/30 border-white/5 hover:border-white/10 hover:bg-slate-900/50'
                }`}
              >
                <button
                  onClick={() => toggleFAQ(index)}
                  className="w-full flex items-center justify-between p-6 text-left outline-none"
                >
                  <span
                    className={`text-sm md:text-base font-bold transition-colors duration-300 ${isOpen ? 'text-blue-400' : 'text-slate-200 group-hover:text-white'}`}
                  >
                    {faq.question}
                  </span>
                  <div
                    className={`p-1.5 rounded-lg transition-all duration-300 ${isOpen ? 'bg-blue-500/20 text-blue-400 rotate-180' : 'bg-white/5 text-slate-500 group-hover:bg-white/10'}`}
                  >
                    <ChevronDown size={18} />
                  </div>
                </button>

                <div
                  className={`transition-all duration-500 ease-in-out px-6 overflow-hidden ${isOpen ? 'max-h-[300px] pb-6 opacity-100' : 'max-h-0 opacity-0'}`}
                >
                  <div className="pt-2 border-t border-white/5">
                    <p className="text-slate-400 text-sm md:text-[15px] leading-relaxed font-medium">
                      <SupportRichText
                        text={faq.answer}
                        linkClassName="font-semibold text-blue-300 underline decoration-blue-500/40 underline-offset-4 hover:text-blue-200"
                      />
                    </p>
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        {/* Community Sidebar Card */}
        <div className="lg:w-80 flex-shrink-0">
          <div className="sticky top-8 p-8 relative rounded-[32px] overflow-hidden border border-blue-500/20 bg-blue-500/5 transition-all hover:bg-blue-500/10 group">
            <div className="absolute top-0 right-0 w-32 h-32 bg-blue-500/10 blur-[60px] -mr-16 -mt-16 pointer-events-none" />
            <div className="relative flex flex-col items-center text-center gap-6">
              <div className="w-16 h-16 rounded-2xl bg-blue-600/20 flex items-center justify-center text-blue-400 border border-blue-500/20 group-hover:scale-110 transition-transform duration-500">
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  width="32"
                  height="32"
                  viewBox="0 0 24 24"
                  fill="currentColor"
                >
                  <path d="M20.317 4.3698a19.7913 19.7913 0 00-4.8851-1.5152.0741.0741 0 00-.0785.0371c-.211.3753-.4447.8648-.6083 1.2495-1.8447-.2758-3.68-.2758-5.4868 0-.1636-.3933-.4058-.8742-.6177-1.2495a.077.077 0 00-.0785-.037 19.7363 19.7363 0 00-4.8852 1.515.0699.0699 0 00-.0321.0277C.5334 9.0458-.319 13.5799.0992 18.0578a.0824.0824 0 00.0312.0561c2.0528 1.5076 4.0413 2.4228 5.9929 3.0294a.0777.0777 0 00.0842-.0276c.4616-.6304.8731-1.2952 1.226-1.9942a.076.076 0 00-.0416-.1057c-.6528-.2476-1.2743-.5495-1.8722-.8923a.077.077 0 01-.0076-.1277c.1258-.0943.2517-.1923.3718-.2914a.0743.0743 0 01.0776-.0105c3.9278 1.7933 8.18 1.7933 12.0614 0a.0739.0739 0 01.0785.0095c.1202.099.246.1971.3728.2914a.077.077 0 01-.0066.1277 12.2986 12.2986 0 01-1.873.8914.0766.0766 0 00-.0407.1067c.3604.698.7719 1.3628 1.2259 1.9932a.076.076 0 00.0842.0286c1.961-.6067 3.9495-1.5219 6.0023-3.0294a.077.077 0 00.0313-.0552c.5004-5.177-.8382-9.6739-3.5485-13.6604a.061.061 0 00-.0312-.0286zM8.02 15.3312c-1.1825 0-2.1569-1.0857-2.1569-2.419 0-1.3332.9555-2.4189 2.157-2.4189 1.2108 0 2.1757 1.0952 2.1568 2.419 0 1.3332-.9555 2.4189-2.1569 2.4189zm7.9748 0c-1.1825 0-2.1569-1.0857-2.1569-2.419 0-1.3332.9554-2.4189 2.1569-2.4189 1.2108 0 2.1757 1.0952 2.1568 2.419 0 1.3332-.946 2.4189-2.1568 2.4189z" />
                </svg>
              </div>
              <div className="space-y-2">
                <h3 className="text-xl font-black text-white tracking-tight uppercase">
                  Still have questions?
                </h3>
                <p className="text-slate-400 text-sm font-medium leading-relaxed">
                  Join Discord to ask follow-up questions, report issues, or suggest product
                  improvements.
                </p>
              </div>
              <button
                onClick={() => window.open('https://discord.gg/N48aHv9xjW', '_blank')}
                className="w-full py-4 bg-blue-600 hover:bg-blue-500 text-white rounded-2xl text-[10px] font-black uppercase tracking-[0.2em] transition-all shadow-xl shadow-blue-600/20 active:scale-[0.98]"
              >
                Join Discord
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default FAQView;
