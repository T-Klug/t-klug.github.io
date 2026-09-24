import { useSyncExternalStore } from 'react';
import { dotDate } from '../lib/format';
import { TOPICS, TOPIC_IDS, isTopic, type TopicId } from '../lib/topics';
import type { PostSummary } from '../lib/posts';

interface Props {
  posts: PostSummary[];
  /** Show the topic chips. The selected topic lives in the URL (?topic=) so it can be shared. */
  filterable?: boolean;
  label?: string;
}

const URL_CHANGE = 'topicchange';

function subscribe(onChange: () => void) {
  window.addEventListener('popstate', onChange);
  window.addEventListener(URL_CHANGE, onChange);
  return () => {
    window.removeEventListener('popstate', onChange);
    window.removeEventListener(URL_CHANGE, onChange);
  };
}

function topicFromUrl(): TopicId | null {
  const value = new URLSearchParams(window.location.search).get('topic');
  return isTopic(value) ? value : null;
}

function setTopicInUrl(topic: TopicId | null) {
  const url = new URL(window.location.href);
  if (topic) url.searchParams.set('topic', topic);
  else url.searchParams.delete('topic');
  window.history.replaceState(null, '', url);
  window.dispatchEvent(new Event(URL_CHANGE));
}

export default function PostTable({ posts, filterable = false, label = 'All posts' }: Props) {
  const urlTopic = useSyncExternalStore(subscribe, topicFromUrl, () => null);
  const topic = filterable ? urlTopic : null;
  const shown = topic ? posts.filter((post) => post.topic === topic) : posts;

  return (
    <div className="post-table">
      <div className="label-bar">
        <span>
          {label} · {shown.length}
        </span>
        {filterable && (
          <div className="chips" role="group" aria-label="Filter posts by topic">
            <button type="button" aria-pressed={topic === null} onClick={() => setTopicInUrl(null)}>
              All
            </button>
            {TOPIC_IDS.map((id) => (
              <button key={id} type="button" aria-pressed={topic === id} onClick={() => setTopicInUrl(id)}>
                {TOPICS[id]}
              </button>
            ))}
          </div>
        )}
      </div>
      <div className="tr hd" aria-hidden="true">
        <span />
        <span>Date</span>
        <span>Title</span>
        <span>Topic</span>
        <span className="rt">Read</span>
      </div>
      <ul className="rows">
        {shown.map((post) => (
          <li key={post.slug}>
            <a className="tr" href={`/posts/${post.slug}/`}>
              <img
                className="thumb"
                src={post.thumb.src}
                srcSet={post.thumb.srcset}
                sizes="120px"
                width={post.thumb.width}
                height={post.thumb.height}
                alt=""
                loading="lazy"
                decoding="async"
              />
              <time dateTime={post.date}>{dotDate(new Date(post.date))}</time>
              <span className="title">{post.title}</span>
              <span className="tp">{TOPICS[post.topic]}</span>
              <span className="rt">{post.minutes} min</span>
            </a>
          </li>
        ))}
      </ul>
    </div>
  );
}
