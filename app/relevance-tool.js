"use client";

import {
  Activity,
  AlertTriangle,
  ArrowDownToLine,
  BriefcaseBusiness,
  Check,
  ChevronRight,
  Clipboard,
  ExternalLink,
  FileJson,
  Gauge,
  Globe2,
  Layers3,
  Link2,
  LoaderCircle,
  MessageCircle,
  Newspaper,
  Quote,
  RadioTower,
  Search,
  Send,
  ShieldCheck,
  Tag,
  TimerReset,
  X
} from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";

const STRICT_SPECIFICITY_SCORE = 100;
const MAX_ARTICLES = 50;
const MAX_DATE_RANGE = "Week";

const CAREERSHERPA_CONTEXT = `Company: CareerSherpa.net
Website: http://www.careersherpa.net

Hannah Morgan | Job Search, Career and Social Media Strategist
Strategies and trends for today's job search. Learn up-to-date job search strategies that work. Stand out and set yourself apart by using social media, visual resumes and other proactive methods for job search and career success.
From the blog: resumes, job search, interviewing, career management, LinkedIn, social media, products and services, Career Essentials membership.`;

export function RelevanceTool() {
  const [context, setContext] = useState(CAREERSHERPA_CONTEXT);
  const [report, setReport] = useState(null);
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [articleModalItem, setArticleModalItem] = useState(null);
  const [isChatOpen, setIsChatOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState("");
  const [copied, setCopied] = useState(false);
  const contextTextareaRef = useRef(null);

  const business = report?.businesses?.[0] ?? null;
  const items = business?.items ?? [];
  const selectedItem = items[selectedIndex] ?? items[0] ?? null;
  const hasReport = Boolean(report);
  const hasStories = items.length > 0;
  const lens = useMemo(() => buildDraftLens({ business, context }), [business, context]);

  const stats = useMemo(() => {
    const articleTotal = items.reduce(
      (total, item) => total + Number(item.article_count || 0),
      0
    );
    const liveMatches = items.filter((item) => item.match?.source === "live").length;
    const avgVirality =
      items.length === 0
        ? 0
        : items.reduce((total, item) => total + Number(item.virality_score || 0), 0) /
          items.length;
    const avgSpecificity =
      items.length === 0
        ? 0
        : items.reduce(
            (total, item) => total + Number(item.business_specificity?.score || 0),
            0
          ) / items.length;

    return {
      stories: items.length,
      articleTotal,
      liveMatches,
      avgVirality,
      avgSpecificity
    };
  }, [items]);

  useEffect(() => {
    if (!report || isLoading) {
      return;
    }

    window.requestAnimationFrame(() => {
      document.querySelector(".insight-layout")?.scrollIntoView({
        behavior: "smooth",
        block: "start"
      });
    });
  }, [isLoading, report]);

  useEffect(() => {
    resizeContextTextarea(contextTextareaRef.current);
  }, [context, hasReport]);

  useEffect(() => {
    if (!articleModalItem) {
      document.body.style.overflow = "";
      return undefined;
    }

    document.body.style.overflow = "hidden";

    function closeOnEscape(event) {
      if (event.key === "Escape") {
        setArticleModalItem(null);
      }
    }

    window.addEventListener("keydown", closeOnEscape);

    return () => {
      document.body.style.overflow = "";
      window.removeEventListener("keydown", closeOnEscape);
    };
  }, [articleModalItem]);

  async function analyzeBusiness(event) {
    event.preventDefault();
    setError("");
    setCopied(false);
    setIsLoading(true);

    try {
      const response = await fetch("/api/relevance", {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          context,
          dateRange: MAX_DATE_RANGE,
          maxArticles: MAX_ARTICLES,
          minSpecificityScore: STRICT_SPECIFICITY_SCORE,
          strictThreshold: true
        })
      });
      const payload = await response.json();

      if (!response.ok) {
        throw new Error(payload.error || "Could not analyze this business.");
      }

      setReport(payload);
      setSelectedIndex(0);
      setArticleModalItem(null);
      setIsChatOpen(false);
    } catch (caughtError) {
      setError(caughtError.message);
    } finally {
      setIsLoading(false);
    }
  }

  async function copyJson() {
    if (!report) {
      return;
    }

    await navigator.clipboard.writeText(JSON.stringify(report, null, 2));
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1800);
  }

  function downloadJson() {
    if (!report) {
      return;
    }

    const blob = new Blob([`${JSON.stringify(report, null, 2)}\n`], {
      type: "application/json"
    });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `${business?.id || "business"}-relevance.json`;
    link.click();
    URL.revokeObjectURL(url);
  }

  return (
    <main className="app-shell">
      <section
        className={`workbench ${hasReport ? "has-report" : "is-ready"}`}
        aria-label="Business relevance workspace"
      >
        <header className="topbar">
          <div className="brand-lockup">
            <span className="brand-mark">
              <RadioTower size={20} aria-hidden="true" />
            </span>
            <div>
              <p className="eyebrow">BTW LiveLM</p>
              <h1>Business relevance desk</h1>
            </div>
          </div>

        </header>

        <form className="scan-console" onSubmit={analyzeBusiness}>
          <div className="context-block">
            <div className="field-head">
              <label className="field-label" htmlFor="business-context">
                Business context
              </label>
              <span>{context.trim().length} chars</span>
            </div>
            <textarea
              id="business-context"
              ref={contextTextareaRef}
              value={context}
              onChange={(event) => {
                setContext(event.target.value);
                resizeContextTextarea(event.target);
              }}
              placeholder="Company: CareerSherpa.net&#10;Website: http://www.careersherpa.net&#10;&#10;Paste homepage text, a short business description, or plain words like: I run a fried chicken shop"
              rows={9}
            />
          </div>

          <div className="scan-rail">
            <BriefPanel lens={lens} />

            <div className="control-stack">
              <button className="analyze-button" disabled={isLoading} type="submit">
                {isLoading ? (
                  <LoaderCircle className="spin" size={18} aria-hidden="true" />
                ) : (
                  <Search size={18} aria-hidden="true" />
                )}
                {isLoading ? "Scanning" : "Find relevant news"}
              </button>
            </div>
          </div>
        </form>

        <StatusStack error={error} />

        {hasReport ? (
          <>
            <section
              className={`insight-layout ${hasStories ? "has-stories" : "no-stories"}`}
              aria-label="Relevance results"
            >
              <section className="results-pane" aria-label="Ranked relevant stories">
                <ResultsHeader business={business} lens={lens} stats={stats} />
                <ResolutionBanner business={business} report={report} />

                <div className="results-list">
                  {isLoading ? <LoadingList /> : null}
                  {!isLoading && items.length === 0 ? (
                    <EmptyState business={business} report={report} />
                  ) : null}
                  {!isLoading &&
                    items.map((item, index) => (
                      <StoryRow
                        isSelected={selectedIndex === index}
                        item={item}
                        key={`${item.story_id}-${index}`}
                        onSelect={() => setSelectedIndex(index)}
                      />
                    ))}
                </div>
              </section>

              {selectedItem ? (
                <section className="detail-panel" aria-label="Selected story details">
                  <StoryDetail
                    copied={copied}
                    item={selectedItem}
                    onCopy={copyJson}
                    onDownload={downloadJson}
                    onOpenChat={() => setIsChatOpen(true)}
                    onOpenArticles={() => setArticleModalItem(selectedItem)}
                    report={report}
                    specialization={business?.specialization}
                  />
                </section>
              ) : (
                <NoResultsPanel lens={lens} />
              )}
            </section>

            {articleModalItem ? (
              <ArticleModal
                item={articleModalItem}
                onClose={() => setArticleModalItem(null)}
              />
            ) : null}

            <EvidenceChat
              business={business}
              isOpen={isChatOpen}
              onOpenChange={setIsChatOpen}
              report={report}
              selectedItem={selectedItem}
            />
          </>
        ) : (
          <ReadySurface lens={lens} />
        )}
      </section>
    </main>
  );
}

function resizeContextTextarea(textarea) {
  if (!textarea) {
    return;
  }

  textarea.style.height = "auto";
  textarea.style.height = `${textarea.scrollHeight}px`;
}

const CHAT_STARTERS = [
  "What should I do with this signal?",
  "Show proof and key points",
  "Draft a source-backed post angle"
];

function EvidenceChat({ business, isOpen, onOpenChange, report, selectedItem }) {
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState("");
  const [isSending, setIsSending] = useState(false);
  const [chatError, setChatError] = useState("");

  useEffect(() => {
    setMessages([]);
    setInput("");
    setChatError("");
  }, [report?.generated_at]);

  useEffect(() => {
    if (!isOpen) {
      return undefined;
    }

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    return () => {
      document.body.style.overflow = previousOverflow;
    };
  }, [isOpen]);

  async function sendMessage(event, starter) {
    event?.preventDefault();
    const question = (starter || input).trim();

    if (!question || isSending) {
      return;
    }

    const nextMessages = [
      ...messages,
      {
        role: "user",
        content: question
      }
    ];

    setMessages(nextMessages);
    setInput("");
    setChatError("");
    setIsSending(true);

    try {
      const response = await fetch("/api/chat", {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          report,
          selectedStoryId: selectedItem?.story_id,
          messages: nextMessages
        })
      });
      const payload = await response.json();

      if (!response.ok) {
        throw new Error(payload.error || "Evidence chat could not answer.");
      }

      setMessages([
        ...nextMessages,
        {
          role: "assistant",
          content: payload.answer,
          citations: payload.citations || [],
          snippets: payload.snippets || [],
          unsupported: payload.unsupported || []
        }
      ]);
    } catch (caughtError) {
      setChatError(caughtError.message);
    } finally {
      setIsSending(false);
    }
  }

  return (
    <>
      <button
        className={`chat-launcher ${isOpen ? "is-open" : ""}`}
        type="button"
        onClick={() => onOpenChange((current) => !current)}
      >
        <MessageCircle size={18} aria-hidden="true" />
        Evidence chat
      </button>

      {isOpen ? (
        <aside
          aria-label="Evidence chat"
          aria-modal="true"
          className="chat-drawer"
          role="dialog"
        >
          <header className="chat-head">
            <div>
              <p className="eyebrow">Source-grounded</p>
              <h2>Chat with this scan</h2>
              <span>{business?.company || "Current business"}</span>
            </div>
            <button
              className="chat-close"
              type="button"
              onClick={() => onOpenChange(false)}
              title="Close chat"
            >
              <X size={17} />
            </button>
          </header>

          <div className="chat-context">
            <span>Selected</span>
            <strong>{selectedItem?.title || "No selected signal"}</strong>
          </div>

          <div className="chat-thread" aria-live="polite">
            {messages.length === 0 ? (
              <div className="chat-empty">
                <MessageCircle size={28} aria-hidden="true" />
                <h3>Ask from the evidence</h3>
                <div className="starter-row">
                  {CHAT_STARTERS.map((starter) => (
                    <button
                      key={starter}
                      type="button"
                      onClick={(event) => sendMessage(event, starter)}
                    >
                      {starter}
                    </button>
                  ))}
                </div>
              </div>
            ) : (
              messages.map((message, index) => (
                <ChatMessage
                  key={`${message.role}-${index}-${message.content}`}
                  message={message}
                />
              ))
            )}

            {isSending ? (
              <div className="chat-thinking">
                <LoaderCircle className="spin" size={17} aria-hidden="true" />
                Reading sources
              </div>
            ) : null}
          </div>

          {chatError ? (
            <div className="chat-error" role="alert">
              <AlertTriangle size={16} aria-hidden="true" />
              {chatError}
            </div>
          ) : null}

          <form className="chat-form" onSubmit={sendMessage}>
            <textarea
              aria-label="Ask evidence chat"
              disabled={isSending}
              onChange={(event) => setInput(event.target.value)}
              placeholder="Ask about proof, risks, reactions, or source-backed angles"
              rows={2}
              value={input}
            />
            <button disabled={isSending || !input.trim()} type="submit">
              <Send size={17} aria-hidden="true" />
            </button>
          </form>
        </aside>
      ) : null}
    </>
  );
}

function ChatMessage({ message }) {
  const isUser = message.role === "user";
  const citationCount = message.citations?.length || 0;
  const snippetCount = message.snippets?.length || 0;

  return (
    <article className={`chat-message ${isUser ? "from-user" : "from-assistant"}`}>
      <span>{isUser ? "You" : "Analyst"}</span>
      <ChatAnswer citations={message.citations || []} text={message.content} />

      {!isUser && citationCount ? (
        <details className="chat-citations" open>
          <summary>
            Sources cited
            <span>{citationCount}</span>
          </summary>
          <div>
            {message.citations.map((citation) => (
              <a
                href={citation.url}
                key={`${citation.id}-${citation.url}`}
                rel="noreferrer"
                target="_blank"
              >
                <strong>{citation.id}</strong>
                {citation.title}
              </a>
            ))}
          </div>
        </details>
      ) : null}

      {!isUser && snippetCount ? (
        <details className="chat-snippets">
          <summary>
            Evidence snippets
            <span>{snippetCount}</span>
          </summary>
          <div>
            {message.snippets.map((snippet) => (
              <blockquote key={`${snippet.source_id}-${snippet.text}`}>
                <Quote size={14} aria-hidden="true" />
                <span>
                  <strong>{snippet.source_id}</strong>
                  {snippet.text}
                </span>
              </blockquote>
            ))}
          </div>
        </details>
      ) : null}

      {!isUser && message.unsupported?.length ? (
        <div className="chat-unsupported">
          <strong>Unsupported by evidence</strong>
          <ul>
            {message.unsupported.map((item) => (
              <li key={item}>{item}</li>
            ))}
          </ul>
        </div>
      ) : null}
    </article>
  );
}

function ChatAnswer({ citations, text }) {
  const blocks = buildChatBlocks(text);
  const citationById = new Map(
    (citations || []).map((citation) => [citation.id, citation])
  );

  return (
    <div className="chat-answer">
      {blocks.map((block, index) => {
        if (block.type === "list") {
          return (
            <ul key={`${block.type}-${index}`}>
              {block.items.map((item) => (
                <li key={item}>{renderLinkedCitations(item, citationById)}</li>
              ))}
            </ul>
          );
        }

        return (
          <p key={`${block.type}-${index}`}>
            {renderLinkedCitations(block.text, citationById)}
          </p>
        );
      })}
    </div>
  );
}

function renderLinkedCitations(text, citationById) {
  return String(text || "")
    .split(/(\[[SE]\d+\])/g)
    .filter(Boolean)
    .map((part, index) => {
      const id = part.match(/^\[([SE]\d+)\]$/)?.[1];
      const citation = id ? citationById.get(id) : null;

      if (!citation?.url) {
        return part;
      }

      return (
        <a
          className="chat-source-ref"
          href={citation.url}
          key={`${part}-${index}`}
          rel="noreferrer"
          target="_blank"
          title={citation.title}
        >
          {part}
        </a>
      );
    });
}

function buildChatBlocks(text) {
  const lines = String(text || "")
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean);
  const blocks = [];
  let paragraph = [];
  let list = [];

  function flushParagraph() {
    if (paragraph.length) {
      blocks.push({
        type: "paragraph",
        text: paragraph.join(" ")
      });
      paragraph = [];
    }
  }

  function flushList() {
    if (list.length) {
      blocks.push({
        type: "list",
        items: list
      });
      list = [];
    }
  }

  lines.forEach((line) => {
    const bullet = line.match(/^[-*]\s+(.+)$/);

    if (bullet) {
      flushParagraph();
      list.push(bullet[1]);
      return;
    }

    flushList();
    paragraph.push(line);
  });

  flushParagraph();
  flushList();

  return blocks.length
    ? blocks
    : [
        {
          type: "paragraph",
          text: ""
        }
      ];
}

function ArticleModal({ item, onClose }) {
  return (
    <div
      className="modal-backdrop"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) {
          onClose();
        }
      }}
    >
      <section
        aria-labelledby="article-modal-title"
        aria-modal="true"
        className="article-modal"
        role="dialog"
      >
        <div className="detail-content">
          <div className="detail-toolbar">
            <div>
              <p className="eyebrow">Source articles</p>
              <h2 id="article-modal-title">{item.title}</h2>
            </div>
            <div className="icon-actions">
              <button
                className="close-action"
                type="button"
                onClick={onClose}
                title="Close articles"
              >
                <X size={17} />
              </button>
            </div>
          </div>
          <ArticleLinks articles={item.articles} showAll />
        </div>
      </section>
    </div>
  );
}

function BriefPanel({ lens }) {
  return (
    <div className="brief-panel">
      <p className="eyebrow">Inferred brief</p>
      <h2>{lens.company}</h2>
      <dl className="brief-list">
        <div>
          <dt>Model</dt>
          <dd>{lens.model}</dd>
        </div>
        <div>
          <dt>Market</dt>
          <dd>{lens.market}</dd>
        </div>
      </dl>
    </div>
  );
}

function ReadySurface({ lens }) {
  return (
    <section className="ready-surface" aria-label="Current relevance brief">
      <div className="ready-brief">
        <p className="eyebrow">Current brief</p>
        <h2>{lens.company}</h2>
        <div className="brief-grid">
          <BriefValue label="Website" value={lens.website || "Not detected"} />
          <BriefValue label="Business model" value={lens.model} />
          <BriefValue label="Market" value={lens.market} />
          <BriefValue label="Reaction type" value={lens.reactionGoal} />
        </div>
      </div>

      <div className="ready-watch">
        <div className="watch-head">
          <ShieldCheck size={18} aria-hidden="true" />
          <h2>Relevance watchlist</h2>
        </div>
        <div className="watch-tags">
          {lens.watchlist.map((item) => (
            <span key={item}>{item}</span>
          ))}
        </div>
      </div>
    </section>
  );
}

function BriefValue({ label, value }) {
  return (
    <div>
      <span>{label}</span>
      <strong>{value}</strong>
    </div>
  );
}

function StatusStack({ error }) {
  if (!error) {
    return null;
  }

  return (
    <div className="status-stack">
      <div className="error-box" role="alert">
        <AlertTriangle size={18} aria-hidden="true" />
        <span>{error}</span>
      </div>
    </div>
  );
}

function ResultsHeader({ business, lens, stats }) {
  const mode = business?.relevance_mode;
  const isBackground = mode === "background";
  const isAdjacent = mode === "adjacent";

  return (
    <header className="results-head">
      <div>
        <p className="eyebrow">
          {isBackground
            ? "Resolved context"
            : isAdjacent
              ? "Adjacent signals"
              : "Ranked signals"}
        </p>
        <h2>{business?.company || lens.company}</h2>
      </div>
      <div className="stats-strip">
        <Metric
          icon={<Newspaper size={17} />}
          label={isBackground ? "Sources" : isAdjacent ? "Signals" : "Stories"}
          value={stats.stories}
        />
        <Metric
          icon={<Link2 size={17} />}
          label={isBackground ? "Links" : "Articles"}
          value={stats.articleTotal}
        />
        {isBackground ? (
          <>
            <Metric icon={<ShieldCheck size={17} />} label="Direct" value="No" />
            <Metric icon={<Gauge size={17} />} label="Mode" value="Context" />
          </>
        ) : (
          <>
            <Metric
              icon={<Activity size={17} />}
              label="Live"
              value={stats.liveMatches}
            />
            <Metric
              icon={<ShieldCheck size={17} />}
              label="Fit"
              value={stats.avgSpecificity.toFixed(0)}
            />
            <Metric
              icon={<Gauge size={17} />}
              label="Viral"
              value={stats.avgVirality.toFixed(1)}
            />
          </>
        )}
      </div>
    </header>
  );
}

function Metric({ icon, label, value }) {
  return (
    <div className="metric">
      <span className="metric-icon">{icon}</span>
      <span>
        <strong>{value}</strong>
        <small>{label}</small>
      </span>
    </div>
  );
}

function StoryRow({ isSelected, item, onSelect }) {
  const isBackground = isBackgroundItem(item);

  return (
    <button
      className={`story-row ${isSelected ? "is-selected" : ""}`}
      type="button"
      onClick={onSelect}
    >
      <span className="rank-badge">{item.rank}</span>
      <span className="story-main">
        <span className="story-title-line">
          <span>{item.title || "Untitled story"}</span>
          <ChevronRight size={17} aria-hidden="true" />
        </span>
        <span className="story-reason">{item.why_relevant}</span>
        <span className="tag-row">
          <StoryTag
            icon={<Activity size={13} />}
            text={formatItemMatch(item)}
          />
          <StoryTag
            icon={<Link2 size={13} />}
            text={`${item.article_count || 0} ${isBackground ? "links" : "articles"}`}
          />
          <StoryTag
            icon={<ShieldCheck size={13} />}
            text={
              isBackground
                ? "resolved context"
                : `${item.business_specificity?.gate || "gate"} ${
                    item.business_specificity?.score || 0
                  }`
            }
          />
          {showThemeTag(item.theme) ? (
            <StoryTag icon={<Tag size={13} />} text={item.theme} />
          ) : null}
        </span>
      </span>
    </button>
  );
}

function StoryTag({ icon, text }) {
  return (
    <span className="story-tag">
      {icon}
      {text}
    </span>
  );
}

function formatMatchLabel(source) {
  if (source === "live") {
    return "live";
  }

  if (source === "detailed") {
    return "source detail";
  }

  if (source === "historical") {
    return "historical";
  }

  if (source === "creator_only") {
    return "story match";
  }

  return "match";
}

function formatItemMatch(item) {
  if (isEntityProfileItem(item)) {
    return "source-backed profile";
  }

  if (item.match_type === "adjacent") {
    return `${formatMatchLabel(item.match?.source)} adjacent`;
  }

  if (isBackgroundItem(item)) {
    return "context source";
  }

  return formatMatchLabel(item.match?.source);
}

function isBackgroundItem(item) {
  return (
    item?.match_type === "background" ||
    item?.match?.source === "exa_background" ||
    isEntityProfileItem(item)
  );
}

function isEntityProfileItem(item) {
  return item?.match?.source === "entity_profile";
}

function showThemeTag(theme) {
  return Boolean(theme);
}

function StoryDetail({
  copied,
  item,
  onCopy,
  onDownload,
  onOpenChat,
  onOpenArticles,
  report,
  specialization
}) {
  const isBackground = isBackgroundItem(item);
  const isEntityProfile = isEntityProfileItem(item);

  return (
    <div className="detail-content">
      <div className="detail-toolbar">
        <div>
          <p className="eyebrow">{isBackground ? "Resolved source" : "Selected signal"}</p>
          <h2>{item.title}</h2>
        </div>
        <div className="detail-action-row">
          <button className="chat-inline-action" type="button" onClick={onOpenChat}>
            <MessageCircle size={17} aria-hidden="true" />
            Ask AI
          </button>
          <div className="icon-actions">
            <button type="button" onClick={onCopy} title="Copy report JSON">
              {copied ? <Check size={17} /> : <Clipboard size={17} />}
            </button>
            <button type="button" onClick={onDownload} title="Download report JSON">
              <ArrowDownToLine size={17} />
            </button>
          </div>
        </div>
      </div>

      <div className="signal-strip">
        {isBackground ? (
          <>
            <Signal label="Source" value="Exa" />
            <Signal label="Links" value={item.article_count || 0} />
            <Signal label="Direct" value="No" />
            <Signal label="Mode" value="Context" />
          </>
        ) : (
          <>
            <Signal label="Virality" value={formatNumber(item.virality_score, 1)} />
            <Signal label="Coverage" value={item.article_count || 0} />
            <Signal label="Specificity" value={item.business_specificity?.score || 0} />
            <Signal label="Match" value={formatItemMatch(item)} />
          </>
        )}
      </div>

      <button className="article-open-button" type="button" onClick={onOpenArticles}>
        <Newspaper size={17} aria-hidden="true" />
        View {item.articles?.length || 0} {isBackground ? "source links" : "article links"}
        <ChevronRight size={17} aria-hidden="true" />
      </button>

      {item.adjacent_context ? (
        <section className="adjacent-note">
          <span>{item.adjacent_context.directness || "adjacent"}</span>
          <p>{item.adjacent_context.directness_reason}</p>
        </section>
      ) : null}

      {isEntityProfile ? <EntityProfileStory item={item} /> : null}

      {!isEntityProfile ? (
        <section className="action-brief">
          <div>
            <span>Impact area</span>
            <strong>{item.business_relevance?.impact_area || "Business signal"}</strong>
          </div>
          <div>
            <span>Audience</span>
            <strong>{item.business_relevance?.audience || "Not specified"}</strong>
          </div>
          <div>
            <span>Recommended reaction</span>
            <strong>
              {item.business_relevance?.recommended_reaction ||
                "Review before taking action."}
            </strong>
          </div>
          {item.business_relevance?.content_angle ? (
            <div>
              <span>Content angle</span>
              <strong>{item.business_relevance.content_angle}</strong>
            </div>
          ) : null}
          {item.business_relevance?.cut_reason ? (
            <div className="cut-warning">
              <span>Cut reason</span>
              <strong>{item.business_relevance.cut_reason}</strong>
            </div>
          ) : null}
        </section>
      ) : null}

      {isBackground ? (
        <BackgroundContextBrief item={item} />
      ) : specialization ? (
        <section className="specialization-brief">
          <BriefValue
            label="Market"
            value={
              [specialization.city, specialization.market].filter(Boolean).join(", ") ||
              "Not set"
            }
          />
          <BriefValue
            label="Inferred model"
            value={specialization.operating_model || "Not set"}
          />
          <BriefValue
            label="Watchlist"
            value={specialization.watchlist?.slice(0, 12).join(", ")}
          />
          <BriefValue
            label="Terms hit"
            value={
              item.business_specificity?.terms?.length
                ? item.business_specificity.terms.join(", ")
                : "No strong terms"
            }
          />
        </section>
      ) : null}

      {!isEntityProfile ? (
        <>
          <section className="detail-section">
            <h3>
              <BriefcaseBusiness size={17} aria-hidden="true" />
              Why it matters
            </h3>
            <p>{item.why_relevant}</p>
          </section>

          <section className="detail-section">
            <h3>
              <Globe2 size={17} aria-hidden="true" />
              {isBackground ? "Source summary" : "Story summary"}
            </h3>
            <p>{item.summary}</p>
          </section>

          <ListSection
            icon={<Layers3 size={17} />}
            items={item.key_points}
            title="Key points"
          />
          <ListSection
            icon={<TimerReset size={17} />}
            items={item.discourse_notes}
            title="Discourse notes"
          />
        </>
      ) : null}

      {item.entities?.length ? (
        <section className="detail-section">
          <h3>
            <Tag size={17} aria-hidden="true" />
            Entities
          </h3>
          <div className="entity-row">
            {item.entities.slice(0, 18).map((entity) => (
              <span key={entity}>{entity}</span>
            ))}
          </div>
        </section>
      ) : null}

      {(item.sentiment?.left || item.sentiment?.right) && (
        <section className="sentiment-grid">
          <div>
            <h3>Left sentiment</h3>
            <p>{item.sentiment.left || "No summary returned."}</p>
          </div>
          <div>
            <h3>Right sentiment</h3>
            <p>{item.sentiment.right || "No summary returned."}</p>
          </div>
        </section>
      )}

      <details className="json-drawer">
        <summary>
          <span className="json-summary-label">
            <FileJson size={17} aria-hidden="true" />
            Raw JSON
          </span>
          <button
            className="json-download-button"
            type="button"
            onClick={(event) => {
              event.preventDefault();
              event.stopPropagation();
              onDownload();
            }}
          >
            <ArrowDownToLine size={16} aria-hidden="true" />
            Download JSON
          </button>
        </summary>
        <pre>{JSON.stringify(report, null, 2)}</pre>
      </details>
    </div>
  );
}

function EntityProfileStory({ item }) {
  const citationById = buildArticleCitationMap(item.articles);
  const sources = item.articles ?? [];

  return (
    <section className="entity-profile-story">
      <div className="entity-story-head">
        <p className="eyebrow">Source-backed story</p>
        <h3>{item.business_relevance?.content_angle || "Who this is"}</h3>
        <p>
          <CitationText citationById={citationById} text={item.summary} />
        </p>
      </div>

      {item.key_points?.length ? (
        <div className="entity-story-points">
          {item.key_points.slice(0, 6).map((point) => (
            <p key={point}>
              <CitationText citationById={citationById} text={point} />
            </p>
          ))}
        </div>
      ) : null}

      {sources.length ? (
        <div className="entity-story-sources">
          <span>Sources used</span>
          <div>
            {sources.slice(0, 6).map((source, index) => {
              const id = source.source_id || `E${index + 1}`;

              return (
                <a
                  href={source.url}
                  key={`${id}-${source.url}`}
                  rel="noreferrer"
                  target="_blank"
                  title={source.title}
                >
                  <strong>{id}</strong>
                  {source.title || "Source"}
                </a>
              );
            })}
          </div>
        </div>
      ) : null}
    </section>
  );
}

function CitationText({ citationById, text }) {
  return renderLinkedCitations(text, citationById);
}

function buildArticleCitationMap(articles = []) {
  return new Map(
    articles.map((article, index) => {
      const id = article.source_id || `E${index + 1}`;

      return [
        id,
        {
          id,
          title: article.title || "Source",
          url: article.url
        }
      ];
    })
  );
}

function BackgroundContextBrief({ item }) {
  const terms = item.business_specificity?.terms ?? [];
  const market = inferBackgroundMarket(terms);

  return (
    <section className="specialization-brief">
      <BriefValue label="Context type" value="Source-backed person/entity context" />
      <BriefValue label="Resolved market" value={market} />
      <BriefValue
        label="Known signals"
        value={terms.length ? terms.slice(0, 12).join(", ") : "Source context only"}
      />
      <BriefValue
        label="Source basis"
        value="BTW was checked first; this view is cleaned from source text because no direct live story matched."
      />
    </section>
  );
}

function inferBackgroundMarket(terms) {
  const normalized = terms.map((term) => term.toLowerCase());

  if (normalized.includes("kuala lumpur")) {
    return "Kuala Lumpur, Malaysia";
  }

  if (normalized.includes("malaysia")) {
    return "Malaysia";
  }

  if (
    normalized.includes("southeast asia") ||
    normalized.includes("southeast asian")
  ) {
    return "Southeast Asia";
  }

  if (normalized.includes("san francisco")) {
    return "San Francisco / United States";
  }

  return "Resolved from source text";
}

function ArticleLinks({ articles, showAll = false }) {
  const visibleArticles = showAll ? articles ?? [] : articles?.slice(0, 8) ?? [];
  const hiddenArticles = showAll ? [] : articles?.slice(8) ?? [];

  return (
    <section className="detail-section article-section">
      <h3>
        <Newspaper size={17} aria-hidden="true" />
        Article links
        {articles?.length ? <span className="section-count">{articles.length}</span> : null}
      </h3>
      {visibleArticles.length ? (
        <>
          <div className="article-list">
            {visibleArticles.map((article) => (
              <ArticleLink article={article} key={`${article.url}-${article.title}`} />
            ))}
          </div>
          {hiddenArticles.length ? (
            <details className="more-articles">
              <summary>Show {hiddenArticles.length} more article links</summary>
              <div className="article-list">
                {hiddenArticles.map((article) => (
                  <ArticleLink article={article} key={`${article.url}-${article.title}`} />
                ))}
              </div>
            </details>
          ) : null}
        </>
      ) : (
        <div className="article-list">
          <p className="muted">No source articles returned for this match.</p>
        </div>
      )}
    </section>
  );
}

function ArticleLink({ article }) {
  const sourceId = article.source_id;

  return (
    <a
      className="article-link"
      href={article.url}
      rel="noreferrer"
      target="_blank"
    >
      <span>
        <strong>
          {sourceId ? <em>{sourceId}</em> : null}
          {article.title || "Source article"}
        </strong>
        <small>{article.timestamp || article.summary || "BTW source"}</small>
      </span>
      <ExternalLink size={16} aria-hidden="true" />
    </a>
  );
}

function Signal({ label, value }) {
  return (
    <div>
      <strong>{value}</strong>
      <span>{label}</span>
    </div>
  );
}

function ListSection({ icon, items, title }) {
  if (!items?.length) {
    return null;
  }

  return (
    <section className="detail-section">
      <h3>
        {icon}
        {title}
      </h3>
      <ul className="detail-list">
        {items.slice(0, 6).map((item) => (
          <li key={item}>{item}</li>
        ))}
      </ul>
    </section>
  );
}

function ResolutionBanner({ business, report }) {
  const resolution = report?.context_resolution;

  if (!resolution && business?.relevance_mode !== "adjacent") {
    return null;
  }

  const sources = resolution?.sources ?? [];

  return (
    <section className="resolution-banner">
      <div>
        <p className="eyebrow">
          {business?.relevance_mode === "adjacent" ||
          business?.relevance_mode === "background"
            ? "No direct signal yet"
            : "Query context"}
        </p>
        <h3>
          {business?.relevance_mode === "background"
            ? "Showing source-backed background"
            : business?.relevance_mode === "adjacent"
            ? "Showing closest source-backed signals"
            : "Context resolved"}
        </h3>
        <p>
          {resolution?.resolution_note ||
            "The scan is using the available context to find related signals."}
        </p>
        {resolution?.resolved_entity?.likely_context?.length ? (
          <div className="resolution-tags">
            {resolution.resolved_entity.likely_context.slice(0, 10).map((item) => (
              <span key={item}>{item}</span>
            ))}
          </div>
        ) : null}
      </div>

      {sources.length ? (
        <div className="resolution-sources">
          {sources.slice(0, 3).map((source) => (
            <a href={source.url} key={source.url} rel="noreferrer" target="_blank">
              <ExternalLink size={14} aria-hidden="true" />
              {source.title}
            </a>
          ))}
        </div>
      ) : null}
    </section>
  );
}

function EmptyState({ business, report }) {
  const resolution = report?.context_resolution;

  return (
    <div className="empty-state">
      <Search size={28} aria-hidden="true" />
      <h2>
        {business?.relevance_mode === "empty"
          ? "No direct or adjacent signal yet"
          : "No stories passed max specificity"}
      </h2>
      <p>
        {resolution?.resolution_note ||
          "Add richer business context and run again."}
      </p>
    </div>
  );
}

function NoResultsPanel({ lens }) {
  return (
    <section className="no-results-panel">
      <AlertTriangle size={28} aria-hidden="true" />
      <h2>No selected signal</h2>
      <p>{lens.company} has no story detail to inspect yet.</p>
    </section>
  );
}

function LoadingList() {
  return (
    <div className="loading-list" aria-label="Loading stories">
      {[1, 2, 3, 4, 5].map((item) => (
        <div className="skeleton-row" key={item}>
          <span />
          <div>
            <span />
            <span />
            <span />
          </div>
        </div>
      ))}
    </div>
  );
}

function buildDraftLens({ business, context }) {
  const specialization = business?.specialization ?? {};
  const inferredDomain = inferDomain(context);
  const company =
    business?.company ||
    extractPrefixedLine(context, "Company") ||
    inferCompanyName(context, inferredDomain);
  const website = business?.website || extractPrefixedLine(context, "Website");
  const model =
    specialization.operating_model ||
    inferModel(context, inferredDomain);
  const market =
    [specialization.city, specialization.market]
      .filter(Boolean)
      .join(", ") || inferMarket(inferredDomain);
  const reactionGoal =
    specialization.reaction_goal ||
    inferReactionGoal(inferredDomain);
  const watchlist = specialization.watchlist?.length
      ? specialization.watchlist
      : inferWatchlist(inferredDomain);

  return {
    company,
    market,
    model,
    reactionGoal,
    watchlist: watchlist.slice(0, 14),
    website
  };
}

function extractPrefixedLine(text, label) {
  const pattern = new RegExp(`^${label}:\\s*(.+)$`, "im");
  return text.match(pattern)?.[1]?.trim() ?? "";
}

function inferDomain(context) {
  const normalized = context.toLowerCase();

  if (
    normalized.includes("fried chicken") ||
    normalized.includes("chicken shop") ||
    normalized.includes("restaurant")
  ) {
    return "fried-chicken";
  }

  if (
    normalized.includes("career") ||
    normalized.includes("resume") ||
    normalized.includes("linkedin") ||
    normalized.includes("job search")
  ) {
    return "career-advice";
  }

  if (
    normalized.includes("purpose") ||
    normalized.includes("on-purpose") ||
    normalized.includes("onpurpose") ||
    normalized.includes("meaningful") ||
    normalized.includes("calling") ||
    normalized.includes("leadership") ||
    normalized.includes("coaching") ||
    normalized.includes("presenter")
  ) {
    return "purpose-leadership";
  }

  if (
    normalized.includes("wine") ||
    normalized.includes("spirits") ||
    normalized.includes("public relations") ||
    normalized.includes("hospitality")
  ) {
    return "food-wine-pr";
  }

  return "general-business";
}

function inferCompanyName(context, domain) {
  if (domain === "fried-chicken") {
    return "Fried Chicken Shop";
  }

  if (context.trim()) {
    return "Pasted business";
  }

  return "Business";
}

function inferModel(context, domain) {
  if (domain === "fried-chicken") {
    return "quick-service fried chicken operator";
  }

  if (domain === "career-advice") {
    return "career advice publisher, coaching, and membership business";
  }

  if (domain === "purpose-leadership") {
    return "purpose-discovery, leadership coaching, membership, training, and licensing business";
  }

  if (domain === "food-wine-pr") {
    return "food, wine, spirits PR and marketing agency";
  }

  return context.trim() ? "business described by pasted context" : "not detected";
}

function inferMarket(domain) {
  if (domain === "fried-chicken") {
    return "local food-service market";
  }

  if (domain === "career-advice") {
    return "United States / English-language job market";
  }

  if (domain === "purpose-leadership") {
    return "United States / English-language purpose, leadership, coaching, and small-business market";
  }

  if (domain === "food-wine-pr") {
    return "United States food, wine, spirits, and hospitality market";
  }

  return "market inferred during scan";
}

function inferReactionGoal(domain) {
  if (domain === "fried-chicken") {
    return "operations, pricing, suppliers, promos, and customer messaging";
  }

  if (domain === "career-advice") {
    return "job-search guidance, blog angles, LinkedIn posts, and member advice";
  }

  if (domain === "purpose-leadership") {
    return "purpose guidance, leadership prompts, coaching content, presenter talking points, and member lessons";
  }

  if (domain === "food-wine-pr") {
    return "client counsel, pitch angles, brand risk, events, and media timing";
  }

  return "business action, content, operations, and customer communication";
}

function inferWatchlist(domain) {
  if (domain === "fried-chicken") {
    return [
      "poultry disease",
      "chicken prices",
      "cooking oil",
      "flour imports",
      "fuel prices",
      "food safety",
      "delivery platform fees",
      "minimum wage",
      "rent",
      "consumer spending"
    ];
  }

  if (domain === "career-advice") {
    return [
      "layoffs",
      "hiring freezes",
      "unemployment",
      "AI recruiting tools",
      "resume screening",
      "LinkedIn changes",
      "remote work",
      "wage data",
      "job scams",
      "skills demand"
    ];
  }

  if (domain === "purpose-leadership") {
    return [
      "workplace burnout",
      "employee engagement",
      "leadership change",
      "AI coaching tools",
      "personal development trends",
      "small business confidence",
      "training budgets",
      "hybrid work",
      "mental wellness",
      "values-led business",
      "entrepreneurship",
      "meaningful work"
    ];
  }

  if (domain === "food-wine-pr") {
    return [
      "food safety",
      "alcohol regulation",
      "tariffs",
      "restaurant demand",
      "consumer sentiment",
      "travel trends",
      "hospitality labor",
      "cultural moments",
      "brand reputation"
    ];
  }

  return [
    "regulation",
    "inflation",
    "supply chain",
    "labor",
    "consumer sentiment",
    "platform changes",
    "competition",
    "reputation risk"
  ];
}

function formatNumber(value, digits) {
  const number = Number(value || 0);
  return Number.isFinite(number) ? number.toFixed(digits) : "0.0";
}
