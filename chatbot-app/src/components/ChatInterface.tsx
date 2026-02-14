import { useEffect, useRef, useCallback, useState } from 'react';
import { Bot, Sparkles, PanelLeft } from 'lucide-react';
import { gsap } from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import { SplitText as GSAPSplitText } from 'gsap/SplitText';
import { useGSAP } from '@gsap/react';
import type { Conversation, AttachedFile, AppSettings } from '../types';
import MessageBubble from './MessageBubble';
import InputBar from './InputBar';
import ModelSelector from './ModelSelector';
import RenderedTitle from './RenderedTitle';

gsap.registerPlugin(ScrollTrigger, GSAPSplitText, useGSAP);

interface ChatInterfaceProps {
  conversation: Conversation | null;
  isLoading: boolean;
  settings: AppSettings;
  onSend: (text: string, attachments: AttachedFile[]) => void;
  onStop: () => void;
  onModelChange: (modelId: string) => void;
  onToggleWebSearch: () => void;
  mobileMode: boolean;
  onToggleDrawer: () => void;
}

interface SplitTextProps {
  text: string;
  className?: string;
  splitBy?: 'chars' | 'words' | 'lines';
  duration?: number;
  stagger?: number;
}

function SplitText({
  text,
  className,
  splitBy = 'words',
  duration = 0.65,
  stagger = 0.03,
}: SplitTextProps) {
  const textRef = useRef<HTMLHeadingElement>(null);

  useGSAP(
    () => {
      if (!textRef.current) {
        return;
      }

      const splitTextInstance = new GSAPSplitText(textRef.current, { type: splitBy });
      const splitElements = splitBy === 'chars' ? splitTextInstance.chars : splitBy === 'lines' ? splitTextInstance.lines : splitTextInstance.words;

      gsap.fromTo(
        splitElements,
        { opacity: 0, yPercent: 120, rotateX: -70 },
        {
          opacity: 1,
          yPercent: 0,
          rotateX: 0,
          duration,
          stagger,
          ease: 'power3.out',
        },
      );

      return () => {
        splitTextInstance.revert();
      };
    },
    { dependencies: [text, splitBy, duration, stagger], scope: textRef },
  );

  return (
    <h2 ref={textRef} className={className}>
      {text}
    </h2>
  );
}

const SUGGESTED_PROMPTS = [
  { icon: '🔍', text: 'Search the latest AI research' },
  { icon: '💻', text: 'Help me debug this code' },
  { icon: '📝', text: 'Summarize an attached document' },
  { icon: '🧪', text: 'Run a calculation and explain it' },
];

const TIME_OF_DAY_GREETINGS = {
  morning: [
    'Good morning, User',
    'Bright morning, User',
    'Wishing you a smooth morning, User',
  ],
  afternoon: [
    'Good afternoon, User',
    'Hope your afternoon is going well, User',
    'Great afternoon energy, User',
  ],
  evening: [
    'Good evening, User',
    'Calm evening to you, User',
    'Nice to see you this evening, User',
  ],
};

const NORMAL_GREETINGS = [
  'Hello, User',
  'Hi, User',
  'Hey, User',
  'Great to see you, User',
  'Nice to see you, User',
  'Welcome back, User',
  'Glad you are here, User',
  'How is it going, User',
  'Good to have you here, User',
  'Ready when you are, User',
  'Good to connect with you, User',
  'Always a pleasure, User',
  'Happy to help, User',
  'Let us get started, User',
  'I am here for you, User',
  'What can I do for you, User',
  'Looking sharp today, User',
  'Thanks for stopping by, User',
  'Your assistant is ready, User',
  'Let us make progress, User',
  'Hope your day is going well, User',
  'Happy to see you again, User',
  'A warm hello to you, User',
  'Welcome in, User',
  'Let us build something great, User',
  'I am listening, User',
  'It is your time, User',
  'Let us solve it together, User',
  'Here we go, User',
  'Excited to help you, User',
  'Your workspace is ready, User',
  'I am at your service, User',
  'Good vibes, User',
  'You are in the right place, User',
  'Your ideas matter, User',
  'Great to chat with you, User',
  'Welcome to your assistant, User',
  'Let us tackle your tasks, User',
  'What should we explore, User',
  'Happy planning, User',
  'Ready for your next move, User',
  'Good momentum, User',
  'Let us dive in, User',
  'You lead, I assist, User',
  'It is great having you here, User',
  'I am prepared, User',
  'Bring me your toughest question, User',
  'Let us get things done, User',
  'Your assistant is on standby, User',
  'I am glad you are here, User',
  'A fresh start for you, User',
  'Let us think it through, User',
  'Your goals are in focus, User',
  'Ready to brainstorm, User',
  'Ready to create, User',
  'Ready to learn, User',
  'Ready to code, User',
  'Ready to write, User',
  'Ready to analyze, User',
  'Ready to plan, User',
  'Ready to research, User',
  'Ready to iterate, User',
  'Ready to execute, User',
  'Ready to optimize, User',
  'Ready to discover, User',
  'Ready to improve, User',
  'Ready to innovate, User',
  'Ready to collaborate, User',
  'Ready to focus, User',
  'Ready to accelerate, User',
  'Ready to simplify, User',
  'Ready to ship, User',
  'Ready to solve, User',
  'Ready to design, User',
  'Ready to test, User',
  'Ready to debug, User',
  'Ready to review, User',
  'Ready to explain, User',
  'Ready to summarize, User',
  'Ready to compare, User',
  'Ready to evaluate, User',
  'Ready to assist quickly, User',
  'Ready to assist carefully, User',
  'Ready to assist clearly, User',
  'Ready to assist fully, User',
  'Welcome aboard, User',
  'Welcome once again, User',
  'Welcome to a productive session, User',
  'Welcome to your command center, User',
  'Welcome to focused work, User',
  'Welcome to smarter workflows, User',
  'Welcome to clear answers, User',
  'Welcome to fast support, User',
  'Welcome to creative thinking, User',
  'Welcome to practical help, User',
  'Let us keep moving, User',
  'Let us keep building, User',
  'Let us keep learning, User',
  'Let us keep improving, User',
  'Let us keep creating, User',
  'Let us keep solving, User',
  'Let us keep exploring, User',
  'Let us keep shipping, User',
  'Let us keep iterating, User',
  'Let us keep winning, User',
  'Good to be with you, User',
  'Great to be here with you, User',
  'Pleased to assist you, User',
  'Honored to support you, User',
  'Thanks for trusting me, User',
  'I value your time, User',
  'I value your focus, User',
  'I value your goals, User',
  'I value your creativity, User',
  'I value your curiosity, User',
  'Your momentum is strong, User',
  'Your direction is clear, User',
  'Your next step is close, User',
  'Your ideas are exciting, User',
  'Your work matters, User',
  'Your progress matters, User',
  'Your vision is welcome, User',
  'Your questions are welcome, User',
  'Your challenges are welcome, User',
  'Your success is the goal, User',
  'Let us make today count, User',
  'Let us make this session count, User',
  'Let us make fast progress, User',
  'Let us make clear decisions, User',
  'Let us make smart moves, User',
  'Let us make a clean plan, User',
  'Let us make a strong draft, User',
  'Let us make a better version, User',
  'Let us make things easier, User',
  'Let us make things clearer, User',
  'I am ready for your prompt, User',
  'I am ready for your idea, User',
  'I am ready for your task, User',
  'I am ready for your draft, User',
  'I am ready for your question, User',
  'I am ready for your challenge, User',
  'I am ready for your project, User',
  'I am ready for your goals, User',
  'I am ready for your plan, User',
  'I am ready for your next step, User',
  'Every session is better with you, User',
  'This space is yours, User',
  'This moment is yours, User',
  'This assistant is yours, User',
  'This workflow is yours, User',
  'This dashboard is yours, User',
  'This conversation is yours, User',
  'This progress is yours, User',
  'This momentum is yours, User',
  'This strategy is yours, User',
  'You are doing great, User',
  'You are moving forward, User',
  'You are building well, User',
  'You are thinking clearly, User',
  'You are asking great questions, User',
  'You are close to a breakthrough, User',
  'You are making smart choices, User',
  'You are in control, User',
  'You are leading the way, User',
  'You are ready, User',
  'I am here with clarity, User',
  'I am here with speed, User',
  'I am here with focus, User',
  'I am here with useful help, User',
  'I am here with practical support, User',
  'I am here with strong ideas, User',
  'I am here with helpful context, User',
  'I am here with clean answers, User',
  'I am here with concise guidance, User',
  'I am here with detailed support, User',
  'Let us shape your next result, User',
  'Let us sharpen your plan, User',
  'Let us organize your ideas, User',
  'Let us outline your options, User',
  'Let us draft your response, User',
  'Let us structure your work, User',
  'Let us complete your task, User',
  'Let us simplify your challenge, User',
  'Let us map your priorities, User',
  'Let us reach your outcome, User',
  'Great to work together, User',
  'Great to help today, User',
  'Great to support your flow, User',
  'Great to support your work, User',
  'Great to support your plans, User',
  'Great to support your creativity, User',
  'Great to support your research, User',
  'Great to support your writing, User',
  'Great to support your coding, User',
  'Great to support your learning, User',
  'Thanks for being here, User',
  'Thanks for returning, User',
  'Thanks for the opportunity, User',
  'Thanks for the challenge, User',
  'Thanks for the question, User',
  'Thanks for your patience, User',
  'Thanks for your trust, User',
  'Thanks for your focus, User',
  'Thanks for your momentum, User',
  'Thanks for your energy, User',
  'Let us open a great session, User',
  'Let us unlock your next step, User',
  'Let us unlock better answers, User',
  'Let us unlock cleaner code, User',
  'Let us unlock stronger writing, User',
  'Let us unlock deeper insight, User',
  'Let us unlock practical wins, User',
  'Let us unlock new ideas, User',
  'Let us unlock faster progress, User',
  'Let us unlock your best work, User',
  'Your assistant is active, User',
  'Your assistant is focused, User',
  'Your assistant is listening, User',
  'Your assistant is prepared, User',
  'Your assistant is ready to help, User',
  'Your assistant is ready to collaborate, User',
  'Your assistant is ready to assist, User',
  'Your assistant is ready to answer, User',
  'Your assistant is ready to build, User',
  'Your assistant is ready to deliver, User',
];

function getTimeGreetings(): string[] {
  const currentHour = new Date().getHours();

  if (currentHour < 12) {
    return TIME_OF_DAY_GREETINGS.morning;
  }

  if (currentHour < 18) {
    return TIME_OF_DAY_GREETINGS.afternoon;
  }

  return TIME_OF_DAY_GREETINGS.evening;
}

export default function ChatInterface({
  conversation,
  isLoading,
  settings,
  onSend,
  onStop,
  onModelChange,
  onToggleWebSearch,
  mobileMode,
  onToggleDrawer,
}: ChatInterfaceProps) {
  const bottomRef = useRef<HTMLDivElement>(null);
  const scrollContainerRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = useCallback((smooth = true) => {
    bottomRef.current?.scrollIntoView({ behavior: smooth ? 'smooth' : 'instant' });
  }, []);

  useEffect(() => {
    scrollToBottom(false);
  }, [conversation?.id, scrollToBottom]);

  useEffect(() => {
    if (isLoading) scrollToBottom(true);
  }, [isLoading, scrollToBottom]);

  useEffect(() => {
    const msgs = conversation?.messages ?? [];
    const lastMsg = msgs[msgs.length - 1];
    if (lastMsg?.isStreaming) scrollToBottom(false);
  }, [conversation?.messages, scrollToBottom]);

  const hasMessages = (conversation?.messages.length ?? 0) > 0;

  return (
    <div className="chat-interface">
      <div className="chat-topbar">
        <div className="chat-topbar-left">
          {mobileMode && (
            <button className="topbar-menu-btn" onClick={onToggleDrawer} aria-label="Toggle sidebar">
              <PanelLeft size={18} />
            </button>
          )}
          <div className="chat-title-area">
            {conversation ? (
              <RenderedTitle title={conversation.title} className="chat-title" />
            ) : (
              <div className="chat-title-logo">
                <div className="logo-mark-small" aria-hidden="true" />
                <span>Nexus AI</span>
              </div>
            )}
          </div>
        </div>
        <div className="chat-topbar-right">
          <ModelSelector
            selectedModel={settings.selectedModel}
            onSelect={onModelChange}
          />
        </div>
      </div>

      <div className="messages-area" ref={scrollContainerRef}>
        {!hasMessages ? (
          <WelcomeScreen onPrompt={(p) => onSend(p, [])} />
        ) : (
          <div className="messages-list">
            {(conversation?.messages ?? []).map((msg) => (
              <MessageBubble key={msg.id} message={msg} />
            ))}
            <div ref={bottomRef} aria-hidden="true" />
          </div>
        )}
      </div>

      <div className="input-area">
        <InputBar
          onSend={onSend}
          onStop={onStop}
          isLoading={isLoading}
          webSearchEnabled={settings.webSearchEnabled}
          onToggleWebSearch={onToggleWebSearch}
        />
        <p className="input-disclaimer">
          Nexus may make mistakes. Verify important information.
        </p>
      </div>
    </div>
  );
}

interface WelcomeScreenProps {
  onPrompt: (text: string) => void;
}

function WelcomeScreen({ onPrompt }: WelcomeScreenProps) {
  const [activeGreeting, setActiveGreeting] = useState(getTimeGreetings()[0]);
  const greetingIndexRef = useRef(0);
  const initialGreetingIntervalRef = useRef<number | null>(null);
  const normalGreetingIntervalRef = useRef<number | null>(null);
  const normalGreetingTimeoutRef = useRef<number | null>(null);

  useEffect(() => {
    const initialGreetings = getTimeGreetings();

    setActiveGreeting(initialGreetings[0]);

    initialGreetingIntervalRef.current = window.setInterval(() => {
      greetingIndexRef.current = (greetingIndexRef.current + 1) % initialGreetings.length;
      setActiveGreeting(initialGreetings[greetingIndexRef.current]);
    }, 2000);

    normalGreetingTimeoutRef.current = window.setTimeout(() => {
      if (initialGreetingIntervalRef.current !== null) {
        window.clearInterval(initialGreetingIntervalRef.current);
      }

      greetingIndexRef.current = 0;
      setActiveGreeting(NORMAL_GREETINGS[0]);

      normalGreetingIntervalRef.current = window.setInterval(() => {
        greetingIndexRef.current = (greetingIndexRef.current + 1) % NORMAL_GREETINGS.length;
        setActiveGreeting(NORMAL_GREETINGS[greetingIndexRef.current]);
      }, 1700);
    }, 6000);

    return () => {
      if (initialGreetingIntervalRef.current !== null) {
        window.clearInterval(initialGreetingIntervalRef.current);
      }
      if (normalGreetingIntervalRef.current !== null) {
        window.clearInterval(normalGreetingIntervalRef.current);
      }
      if (normalGreetingTimeoutRef.current !== null) {
        window.clearTimeout(normalGreetingTimeoutRef.current);
      }
      gsap.killTweensOf('.welcome-greeting-text');
    };
  }, []);

  return (
    <div className="welcome-screen">
      <div className="welcome-hero">
        <div className="welcome-icon-wrap" aria-hidden="true">
          <Bot size={40} />
          <Sparkles size={20} className="welcome-sparkle" />
        </div>
        <div className="welcome-greeting-block" aria-live="polite">
          <SplitText key={activeGreeting} text={activeGreeting} className="welcome-greeting-text" splitBy="words" />
        </div>
      </div>

      <div className="welcome-prompts">
        {SUGGESTED_PROMPTS.map((p) => (
          <button
            key={p.text}
            className="prompt-chip"
            onClick={() => onPrompt(p.text)}
          >
            <span className="prompt-chip-icon">{p.icon}</span>
            <span>{p.text}</span>
          </button>
        ))}
      </div>

      <div className="welcome-features">
        <div className="feature-pill">🔍 Web Search</div>
        <div className="feature-pill">📎 File Attachments</div>
        <div className="feature-pill">🤖 Subagent Registry</div>
        <div className="feature-pill">📄 File Analysis</div>
        <div className="feature-pill">💻 Code Execution</div>
      </div>
    </div>
  );
}
