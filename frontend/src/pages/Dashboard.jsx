import { useState, useEffect, useRef } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { getEntries, createEntry, deleteEntry } from '../api';

export default function Dashboard() {
  const { user, signOut } = useAuth();
  const [entries, setEntries]     = useState([]);
  const [loading, setLoading]     = useState(true);
  const [error, setError]         = useState('');
  const [showForm, setShowForm]   = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [form, setForm]           = useState({ title: '', body: '' });
  const [imageFile, setImageFile] = useState(null);
  const [preview, setPreview]     = useState(null);
  const fileInputRef = useRef(null);

  useEffect(() => {
    loadEntries();
  }, []);

  async function loadEntries() {
    setLoading(true);
    setError('');
    try {
      setEntries(await getEntries());
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  const handleImageChange = (e) => {
    const file = e.target.files[0] || null;
    setImageFile(file);
    if (file) {
      const reader = new FileReader();
      reader.onload = (ev) => setPreview(ev.target.result);
      reader.readAsDataURL(file);
    } else {
      setPreview(null);
    }
  };

  const resetForm = () => {
    setForm({ title: '', body: '' });
    setImageFile(null);
    setPreview(null);
    if (fileInputRef.current) fileInputRef.current.value = '';
    setShowForm(false);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSubmitting(true);
    setError('');
    try {
      const fd = new FormData();
      fd.append('title', form.title);
      fd.append('body', form.body);
      if (imageFile) fd.append('image', imageFile);

      const entry = await createEntry(fd);
      setEntries((prev) => [entry, ...prev]);
      resetForm();
    } catch (err) {
      setError(err.message);
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async (id) => {
    if (!window.confirm('Delete this entry permanently?')) return;
    try {
      await deleteEntry(id);
      setEntries((prev) => prev.filter((e) => e._id !== id));
    } catch (err) {
      setError(err.message);
    }
  };

  return (
    <div className="dashboard">
      <header className="dashboard-header">
        <span className="header-logo">My Diary</span>
        <div className="header-right">
          <span className="header-user">Welcome, {user?.username}</span>
          <button className="btn-ghost" onClick={signOut}>Sign Out</button>
        </div>
      </header>

      <main className="dashboard-main">
        {error && (
          <div className="error-banner" style={{ marginBottom: '1rem' }}>{error}</div>
        )}

        <div className="toolbar">
          <button
            className={showForm ? 'btn-secondary' : 'btn-primary'}
            onClick={() => { setShowForm(!showForm); setError(''); }}
          >
            {showForm ? 'Cancel' : '+ New Entry'}
          </button>
        </div>

        {showForm && (
          <section className="form-card">
            <h2>New Entry</h2>
            <form onSubmit={handleSubmit}>
              <label htmlFor="title">Title</label>
              <input
                id="title"
                type="text"
                value={form.title}
                onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))}
                placeholder="Give your entry a title"
                required
                autoFocus
              />
              <label htmlFor="body">Entry</label>
              <textarea
                id="body"
                value={form.body}
                onChange={(e) => setForm((f) => ({ ...f, body: e.target.value }))}
                placeholder="What's on your mind today?"
                rows={7}
                required
              />
              <label htmlFor="image">Photo (optional)</label>
              <input
                id="image"
                type="file"
                accept="image/jpeg,image/png,image/gif,image/webp"
                onChange={handleImageChange}
                ref={fileInputRef}
              />
              {preview && (
                <img className="img-preview" src={preview} alt="Selected" />
              )}
              <button type="submit" className="btn-primary" disabled={submitting}>
                {submitting ? 'Saving...' : 'Save Entry'}
              </button>
            </form>
          </section>
        )}

        {loading ? (
          <div className="state-placeholder">Loading entries...</div>
        ) : entries.length === 0 ? (
          <div className="state-placeholder">
            <p>No entries yet.</p>
            <p>Click <strong>+ New Entry</strong> to write your first one.</p>
          </div>
        ) : (
          <div className="entries-list">
            {entries.map((entry) => (
              <article key={entry._id} className="entry-card">
                {entry.imageUrl && (
                  <img
                    className="entry-img"
                    src={entry.imageUrl}
                    alt={entry.title}
                    loading="lazy"
                  />
                )}
                <div className="entry-body">
                  <h3 className="entry-title">{entry.title}</h3>
                  <time className="entry-date">
                    {new Date(entry.createdAt).toLocaleDateString('en-AU', {
                      weekday: 'long',
                      year: 'numeric',
                      month: 'long',
                      day: 'numeric',
                    })}
                  </time>
                  <p className="entry-text">{entry.body}</p>
                  <button className="btn-danger" onClick={() => handleDelete(entry._id)}>
                    Delete
                  </button>
                </div>
              </article>
            ))}
          </div>
        )}
      </main>
    </div>
  );
}
