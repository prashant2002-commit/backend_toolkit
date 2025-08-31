require("dotenv").config();
const express = require("express");
const path = require("path");
const app = express();
const { exec } = require("child_process");
const fs = require("fs");

const PORT = process.env.PORT || 3000;

// Middleware to serve static files from the "public" directory
app.use(express.static(path.join(__dirname, "public")));
app.use(express.static("public"));
app.use(express.json());

// Route for the idea generation page
app.get("/", (req, res) => {
  res.sendFile(path.join(__dirname, "/public/vedioIdeaGenerator.html"));
});

// Route for tags generator page
app.get("/tags-generator", (req, res) => {
  res.sendFile(path.join(__dirname, "/public/viralTagGenerator.html"));
});

app.get("/youtube-analytics", (req, res) => {
  res.sendFile(path.join(__dirname, "/public/channelStatsFinder.html"));
});

app.get("/copyright-checker", (req, res) => {
  res.sendFile(path.join(__dirname, "/public/ytCopyRightChecker.html"));
});

app.get("/title-generator", (req, res) => {
  res.sendFile(path.join(__dirname, "/public/titleGenerator.html"));
});

app.get("/script-generator", (req, res) => {
  res.sendFile(path.join(__dirname, "/public/vedioScriptGenerator.html"));
});


// API endpoint to handle idea generation (proxy to avoid exposing API key)
app.post("/api/generate-ideas", express.json(), async (req, res) => {
  const { keyword, region, settings } = req.body;

  try {
    const apiKey = process.env.GEMINI_API_KEY;
    const apiUrl = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-preview-05-20:generateContent?key=${apiKey}`;

    const prompt = `You are a creative assistant for a YouTube creator. Generate a list of 25 diverse and interesting video ideas based on the keyword: "${keyword}". 
        
        For each idea, provide:
        - A catchy, clickable "title".
        - A "hook" to grab the viewer's attention in the first 5 seconds.
        - An "angle" (e.g., Tutorial, Review, Challenge, Documentary, Vlog, Experiment, Deep Dive).
        - A "format" (e.g., Talking Head, How-To, Cinematic, Video Essay).
        - A "popularity" score (0-100) estimating its potential reach.
        - A "relevance" score (0-100) to the core keyword.
        - A "novelty" score (0-100) for how unique the idea is.
        - A "generic" boolean (true if it's a very common idea like "how to make coffee").
        
        Focus on creativity and avoid overly generic or saturated topics unless they have a very unique twist. If the region is 'India', include some ideas that are culturally or geographically specific to India. Current region focus: ${region}.`;

    const payload = {
      contents: [{ role: "user", parts: [{ text: prompt }] }],
      generationConfig: {
        responseMimeType: "application/json",
        responseSchema: {
          type: "OBJECT",
          properties: {
            video_ideas: {
              type: "ARRAY",
              items: {
                type: "OBJECT",
                properties: {
                  title: { type: "STRING" },
                  hook: { type: "STRING" },
                  angle: { type: "STRING" },
                  format: { type: "STRING" },
                  popularity: { type: "NUMBER" },
                  relevance: { type: "NUMBER" },
                  novelty: { type: "NUMBER" },
                  generic: { type: "BOOLEAN" },
                },
                required: [
                  "title",
                  "hook",
                  "angle",
                  "format",
                  "popularity",
                  "relevance",
                  "novelty",
                  "generic",
                ],
              },
            },
          },
        },
      },
    };

    const response = await fetch(apiUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });

    if (!response.ok) {
      throw new Error(`API error: ${response.status} ${response.statusText}`);
    }

    const result = await response.json();
    res.json(result);
  } catch (error) {
    console.error("Generation failed:", error);
    res.status(500).json({ error: error.message });
  }
});

// API endpoint for viral tag generation (using YouTube API)
app.post("/api/generate-tags", express.json(), async (req, res) => {
  const { topic, timeRange } = req.body;

  try {
    const YOUTUBE_API_KEY = process.env.YOUTUBE_API_KEY;

    if (!YOUTUBE_API_KEY) {
      throw new Error("YouTube API key not configured");
    }

    const tags = new Set();
    const tagStats = {};

    const publishedAfter = getPublishedAfterDate(timeRange);

    const searchUrl = `https://www.googleapis.com/youtube/v3/search?part=snippet&q=${encodeURIComponent(
      topic
    )}&type=video&order=viewCount&maxResults=50&publishedAfter=${publishedAfter}&key=${YOUTUBE_API_KEY}`;

    const searchResponse = await fetch(searchUrl);
    if (!searchResponse.ok) {
      throw new Error("Failed to fetch YouTube data");
    }

    const searchData = await searchResponse.json();

    if (!searchData.items || searchData.items.length === 0) {
      throw new Error(
        "No videos found for this topic in the selected time range"
      );
    }

    for (const video of searchData.items) {
      const title = video.snippet.title.toLowerCase();
      const description = video.snippet.description.toLowerCase();

      const hashtagMatches = description.match(/#\w+/g) || [];
      hashtagMatches.forEach((hashtag) => {
        const tag = hashtag.substring(1);
        if (tag.length > 2) {
          tags.add(tag);
          tagStats[tag] = (tagStats[tag] || 0) + 1;
        }
      });

      const titleWords = title
        .split(/\s+/)
        .filter(
          (word) =>
            word.length > 3 &&
            ![
              "with",
              "this",
              "that",
              "from",
              "they",
              "have",
              "will",
              "been",
              "were",
              "said",
              "each",
              "which",
              "their",
              "time",
              "more",
              "very",
              "what",
              "know",
              "just",
              "first",
              "into",
              "over",
              "think",
              "also",
              "your",
              "work",
              "life",
              "only",
              "new",
              "years",
              "way",
              "may",
              "say",
              "come",
              "its",
              "now",
              "find",
              "long",
              "down",
              "day",
              "did",
              "get",
              "has",
              "him",
              "his",
              "how",
              "man",
              "old",
              "see",
              "two",
              "who",
              "boy",
              "did",
              "its",
              "let",
              "put",
              "say",
              "she",
              "too",
              "use",
            ].includes(word)
        );

      titleWords.forEach((word) => {
        const cleanWord = word.replace(/[^\w]/g, "");
        if (cleanWord.length > 3) {
          tags.add(cleanWord);
          tagStats[cleanWord] = (tagStats[cleanWord] || 0) + 1;
        }
      });
    }

    const trendingKeywords = await fetchTrendingKeywords(
      topic,
      timeRange,
      YOUTUBE_API_KEY
    );
    trendingKeywords.forEach((keyword) => {
      tags.add(keyword);
      tagStats[keyword] =
        (tagStats[keyword] || 0) + Math.floor(Math.random() * 10) + 5;
    });

    const sortedTags = Array.from(tags)
      .map((tag) => ({
        tag: tag,
        popularity: tagStats[tag] || 1,
        videos: Math.floor(Math.random() * 1000) + 100,
      }))
      .sort((a, b) => b.popularity - a.popularity)
      .slice(0, 30);

    res.json({ tags: sortedTags });
  } catch (error) {
    console.error("Tag generation failed:", error);
    res.status(500).json({ error: error.message });
  }
});

// Helper functions for tag generation
function getPublishedAfterDate(timeRange) {
  const now = new Date();
  let publishedAfter;

  switch (timeRange) {
    case "day":
      publishedAfter = new Date(now.getTime() - 24 * 60 * 60 * 1000);
      break;
    case "week":
      publishedAfter = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
      break;
    case "month":
      publishedAfter = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
      break;
    case "year":
      publishedAfter = new Date(now.getTime() - 365 * 24 * 60 * 60 * 1000);
      break;
    default:
      publishedAfter = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
  }

  return publishedAfter.toISOString();
}

async function fetchTrendingKeywords(topic, timeRange, apiKey) {
  const keywords = [];
  const publishedAfter = getPublishedAfterDate(timeRange);

  const relatedSearches = [
    `${topic} trending`,
    `${topic} viral`,
    `${topic} popular`,
    `best ${topic}`,
    `${topic} 2024`,
  ];

  for (const search of relatedSearches) {
    try {
      const url = `https://www.googleapis.com/youtube/v3/search?part=snippet&q=${encodeURIComponent(
        search
      )}&type=video&order=relevance&maxResults=10&publishedAfter=${publishedAfter}&key=${apiKey}`;
      const response = await fetch(url);

      if (response.ok) {
        const data = await response.json();
        data.items?.forEach((video) => {
          const title = video.snippet.title.toLowerCase();
          const words = title
            .split(/\s+/)
            .filter(
              (word) =>
                word.length > 3 &&
                !word.includes(topic.toLowerCase()) &&
                /^[a-zA-Z]+$/.test(word)
            );
          keywords.push(...words.slice(0, 3));
        });
      }
    } catch (error) {
      console.log("Error fetching related keywords:", error);
    }
  }

  return [...new Set(keywords)].slice(0, 10);
}

// API endpoint for YouTube channel analytics
app.post("/api/youtube-analytics", express.json(), async (req, res) => {
  const { channelInput } = req.body;

  try {
    const YOUTUBE_API_KEY = process.env.YOUTUBE_API_KEY;

    if (!YOUTUBE_API_KEY) {
      throw new Error("YouTube API key not configured");
    }

    // Extract channel ID
    const channelId = await extractChannelId(channelInput, YOUTUBE_API_KEY);

    // Get channel stats
    const channelData = await getChannelStats(channelId, YOUTUBE_API_KEY);
    const stats = channelData.statistics;
    const snippet = channelData.snippet;

    // Get recent videos
    const videos = await getLatestVideos(channelId, 6, YOUTUBE_API_KEY);
    const videoIds = videos.map((video) => video.id.videoId);
    const videoStats = await getVideoStats(videoIds, YOUTUBE_API_KEY);

    // Calculate engagement insights
    const engagementInsights = calculateEngagementInsights(videoStats);

    res.json({
      success: true,
      channelData: {
        snippet,
        statistics: stats,
      },
      videos,
      videoStats,
      engagementInsights,
    });
  } catch (error) {
    console.error("YouTube analytics failed:", error);
    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
});

// Helper functions for tag generation
function getPublishedAfterDate(timeRange) {
  const now = new Date();
  let publishedAfter;

  switch (timeRange) {
    case "day":
      publishedAfter = new Date(now.getTime() - 24 * 60 * 60 * 1000);
      break;
    case "week":
      publishedAfter = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
      break;
    case "month":
      publishedAfter = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
      break;
    case "year":
      publishedAfter = new Date(now.getTime() - 365 * 24 * 60 * 60 * 1000);
      break;
    default:
      publishedAfter = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
  }

  return publishedAfter.toISOString();
}

async function fetchTrendingKeywords(topic, timeRange, apiKey) {
  const keywords = [];
  const publishedAfter = getPublishedAfterDate(timeRange);

  const relatedSearches = [
    `${topic} trending`,
    `${topic} viral`,
    `${topic} popular`,
    `best ${topic}`,
    `${topic} 2024`,
  ];

  for (const search of relatedSearches) {
    try {
      const url = `https://www.googleapis.com/youtube/v3/search?part=snippet&q=${encodeURIComponent(
        search
      )}&type=video&order=relevance&maxResults=10&publishedAfter=${publishedAfter}&key=${apiKey}`;
      const response = await fetch(url);

      if (response.ok) {
        const data = await response.json();
        data.items?.forEach((video) => {
          const title = video.snippet.title.toLowerCase();
          const words = title
            .split(/\s+/)
            .filter(
              (word) =>
                word.length > 3 &&
                !word.includes(topic.toLowerCase()) &&
                /^[a-zA-Z]+$/.test(word)
            );
          keywords.push(...words.slice(0, 3));
        });
      }
    } catch (error) {
      console.log("Error fetching related keywords:", error);
    }
  }

  return [...new Set(keywords)].slice(0, 10);
}

// Helper functions for YouTube Analytics
async function extractChannelId(input, apiKey) {
  input = input.trim();

  // Direct channel ID
  if (input.match(/^UC[a-zA-Z0-9_-]{22}$/)) {
    return input;
  }

  // Channel URL patterns
  const urlPatterns = [
    /youtube\.com\/channel\/([a-zA-Z0-9_-]+)/,
    /youtube\.com\/c\/([a-zA-Z0-9_-]+)/,
    /youtube\.com\/user\/([a-zA-Z0-9_-]+)/,
    /youtube\.com\/@([a-zA-Z0-9_-]+)/,
  ];

  for (const pattern of urlPatterns) {
    const match = input.match(pattern);
    if (match) {
      if (input.includes("/@")) {
        return searchChannelByHandle(match[1], apiKey);
      }
      return match[1];
    }
  }

  // Handle format
  if (input.startsWith("@")) {
    return searchChannelByHandle(input, apiKey);
  }

  // Assume it's a channel name or handle
  return searchChannelByHandle(input, apiKey);
}

async function getChannelStats(channelId, apiKey) {
  const url = `https://www.googleapis.com/youtube/v3/channels?part=statistics,snippet&id=${channelId}&key=${apiKey}`;
  const response = await fetch(url);
  if (!response.ok) throw new Error("Failed to fetch channel stats");
  const data = await response.json();
  if (!data.items || data.items.length === 0)
    throw new Error("Channel not found");
  return data.items[0];
}

async function getLatestVideos(channelId, maxResults, apiKey) {
  const url = `https://www.googleapis.com/youtube/v3/search?key=${apiKey}&channelId=${channelId}&part=snippet,id&order=date&maxResults=${maxResults}&type=video`;
  const response = await fetch(url);
  if (!response.ok) throw new Error("Failed to fetch videos");
  const data = await response.json();
  return data.items.filter((item) => item.id.kind === "youtube#video");
}

async function getVideoStats(videoIds, apiKey) {
  const url = `https://www.googleapis.com/youtube/v3/videos?part=statistics,snippet&id=${videoIds.join(
    ","
  )}&key=${apiKey}`;
  const response = await fetch(url);
  if (!response.ok) throw new Error("Failed to fetch video stats");
  const data = await response.json();
  return data.items;
}

async function searchChannelByHandle(handle, apiKey) {
  const cleanHandle = handle
    .replace("@", "")
    .replace("https://www.youtube.com/@", "");
  const url = `https://www.googleapis.com/youtube/v3/search?part=snippet&type=channel&q=${cleanHandle}&key=${apiKey}&maxResults=1`;
  const response = await fetch(url);
  if (!response.ok) throw new Error("Failed to search channel");
  const data = await response.json();
  if (!data.items || data.items.length === 0)
    throw new Error("Channel not found");
  return data.items[0].id.channelId;
}

function calculateEngagementInsights(videoStats) {
  let totalLikes = 0;
  let totalComments = 0;
  let totalViews = 0;
  let maxEngagement = 0;

  videoStats.forEach((video) => {
    const likes = parseInt(video.statistics.likeCount || 0);
    const comments = parseInt(video.statistics.commentCount || 0);
    const views = parseInt(video.statistics.viewCount || 0);

    totalLikes += likes;
    totalComments += comments;
    totalViews += views;

    const engagement = calculateEngagementRate(likes, comments, views);
    if (engagement > maxEngagement) {
      maxEngagement = engagement;
    }
  });

  const avgLikes =
    videoStats.length > 0 ? Math.round(totalLikes / videoStats.length) : 0;
  const avgComments =
    videoStats.length > 0 ? Math.round(totalComments / videoStats.length) : 0;
  const engagementScore =
    totalViews > 0
      ? (((totalLikes + totalComments) / totalViews) * 100).toFixed(1)
      : 0;

  return {
    avgLikes,
    avgComments,
    engagementScore,
    bestPerforming: maxEngagement,
  };
}

function calculateEngagementRate(likes, comments, views) {
  if (!views || views === 0) return 0;
  const engagement =
    (parseInt(likes || 0) + parseInt(comments || 0)) / parseInt(views);
  return (engagement * 100).toFixed(1);
}

function formatNumber(num) {
  if (num >= 1000000) {
    return (num / 1000000).toFixed(1) + "M";
  } else if (num >= 1000) {
    return (num / 1000).toFixed(1) + "K";
  }
  return num.toString();
}

// API endpoint for YouTube copyright checking
app.post("/api/check-copyright", express.json(), async (req, res) => {
  const { videoUrl } = req.body;

  try {
    const YOUTUBE_API_KEY = process.env.YOUTUBE_API_KEY;

    if (!YOUTUBE_API_KEY) {
      throw new Error("YouTube API key not configured");
    }

    // Extract YouTube video ID from URL
    function extractVideoId(url) {
      const patterns = [
        /(?:youtube\.com\/watch\?v=|youtu\.be\/|youtube\.com\/embed\/)([^&\n?#]+)/,
        /youtube\.com\/v\/([^&\n?#]+)/,
      ];

      for (const pattern of patterns) {
        const match = url.match(pattern);
        if (match) return match[1];
      }
      return null;
    }

    const videoId = extractVideoId(videoUrl);
    if (!videoId) {
      throw new Error("Invalid YouTube URL");
    }

    // Check video license using YouTube API
    const url = `https://www.googleapis.com/youtube/v3/videos?part=status&id=${videoId}&key=${YOUTUBE_API_KEY}`;

    const response = await fetch(url);
    if (!response.ok) {
      throw new Error("Failed to fetch video data from YouTube API");
    }

    const data = await response.json();
    if (!data.items || data.items.length === 0) {
      throw new Error("Video not found");
    }

    const license = data.items[0].status.license;
    let licenseStatus, className;

    if (license === "youtube") {
      licenseStatus = "Standard YouTube License (Copyrighted)";
      className = "license-copyright";
    } else if (license === "creativeCommon") {
      licenseStatus = "Creative Commons (Reusable with Attribution)";
      className = "license-cc";
    } else {
      licenseStatus = "Unknown License";
      className = "license-error";
    }

    res.json({
      success: true,
      videoUrl,
      videoId,
      licenseStatus,
      className,
    });
  } catch (error) {
    console.error("Copyright check failed:", error);
    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
});

// API endpoint for YouTube title generation
app.post("/api/generate-titles", express.json(), async (req, res) => {
  const { topic, audience } = req.body;

  if (!topic) {
    return res.status(400).json({ error: "Topic is required" });
  }

  try {
    const YOUTUBE_API_KEY = process.env.YOUTUBE_API_KEY;
    const GEMINI_API_KEY = process.env.GEMINI_API_KEY;

    if (!YOUTUBE_API_KEY) {
      return res.status(500).json({ error: "YouTube API key not configured" });
    }

    if (!GEMINI_API_KEY) {
      return res.status(500).json({ error: "Gemini API key not configured" });
    }

    // Fetch trending videos from YouTube
    const trendingVideos = await fetchTrendingVideos(YOUTUBE_API_KEY, topic);

    // Extract trending titles
    const trendingTitles = extractTrendingTitles(trendingVideos);

    // Generate AI titles using Gemini API
    const aiTitles = await generateAITitles(
      GEMINI_API_KEY,
      topic,
      audience,
      trendingVideos
    );

    // Combine results
    const allTitles = [...aiTitles, ...trendingTitles].slice(0, 10);

    res.json({ success: true, titles: allTitles });
  } catch (error) {
    console.error("Error generating titles:", error);
    res.status(500).json({
      success: false,
      error:
        error.message ||
        "Failed to generate titles. Please check your API keys and try again.",
    });
  }
});

// Helper function to fetch trending videos from YouTube
async function fetchTrendingVideos(apiKey, topic) {
  try {
    const searchUrl = `https://www.googleapis.com/youtube/v3/search?part=snippet&q=${encodeURIComponent(
      topic
    )}&type=video&order=viewCount&maxResults=15&key=${apiKey}`;

    const response = await fetch(searchUrl);
    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(
        `YouTube API error: ${errorData.error?.message || response.status}`
      );
    }

    const data = await response.json();
    return data.items || [];
  } catch (error) {
    console.error("Error fetching trending videos:", error);
    throw error;
  }
}

// Helper function to generate AI titles using Gemini API
async function generateAITitles(apiKey, topic, audience, trendingVideos) {
  try {
    const prompt = `Generate 10 compelling YouTube video titles about "${topic}" targeted at ${audience} audience. 
        Here are some examples of trending titles: ${trendingVideos
          .slice(0, 5)
          .map((t) => t.snippet.title)
          .join(", ")}.
        Make the titles engaging, clickable, and optimized for YouTube. 
        Return only the titles, one per line, without numbers or bullets.`;

    // Use the correct Gemini API endpoint
    const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-pro:generateContent?key=${apiKey}`;

    const response = await fetch(
      "https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent",
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-goog-api-key": apiKey,
        },
        body: JSON.stringify({
          contents: [
            {
              parts: [{ text: prompt }],
            },
          ],
        }),
      }
    );

    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(
        `Gemini API error: ${errorData.error?.message || response.status}`
      );
    }

    const data = await response.json();

    // Extract text from the response - handle the correct structure
    let generatedText = "";

    // Check different possible response structures
    if (data.candidates && data.candidates[0]) {
      if (data.candidates[0].content) {
        if (
          data.candidates[0].content.parts &&
          data.candidates[0].content.parts[0]
        ) {
          generatedText = data.candidates[0].content.parts[0].text;
        } else if (data.candidates[0].content.text) {
          generatedText = data.candidates[0].content.text;
        }
      }
    } else if (data.choices && data.choices[0]) {
      if (data.choices[0].message && data.choices[0].message.content) {
        generatedText = data.choices[0].message.content;
      }
    } else if (data.text) {
      generatedText = data.text;
    }

    // Log what we found
    if (generatedText) {
      console.log(
        "Generated text found:",
        generatedText.substring(0, 100) + "..."
      );
    } else {
      console.log("No generated text found in expected locations");

      // Try to find text anywhere in the response
      const textSearch = findTextInResponse(data);
      if (textSearch) {
        generatedText = textSearch;
        console.log(
          "Found text by searching:",
          generatedText.substring(0, 100) + "..."
        );
      }
    }

    if (!generatedText) {
      console.log("=== RESPONSE ANALYSIS FAILED ===");
      console.log("Could not find generated text in any expected location");
      throw new Error(
        "Unexpected response format from Gemini API. Could not extract generated text."
      );
    }

    // Process the generated text
    return generatedText
      .split("\n")
      .filter((title) => title.trim())
      .map((title) =>
        title
          .replace(/^\d+[\.\-\)]\s*/, "")
          .replace(/^[-*]\s*/, "")
          .trim()
      )
      .filter((title) => title.length > 10)
      .slice(0, 10);
  } catch (error) {
    console.error("=== ERROR IN generateAITitles ===");
    console.error("Error message:", error.message);
    console.error("Error stack:", error.stack);
    throw error;
  }
}

// Helper function to search for text in the response object
function findTextInResponse(obj, depth = 0, path = "") {
  if (depth > 5) return null; // Prevent infinite recursion

  if (typeof obj === "string" && obj.length > 20) {
    return obj;
  }

  if (typeof obj === "object" && obj !== null) {
    for (let key in obj) {
      if (obj.hasOwnProperty(key)) {
        const result = findTextInResponse(
          obj[key],
          depth + 1,
          path + "." + key
        );
        if (result) return result;
      }
    }
  }

  return null;
}
// Helper function to extract titles from trending videos
function extractTrendingTitles(videos) {
  return videos
    .map((video) => video.snippet.title)
    .filter((title) => title && title.length > 10)
    .slice(0, 10);
}

//api endpoint for script generator
app.post("/api/generate-script", async (req, res) => {
  try {
    const GEMINI_API_KEY = process.env.GEMINI_API_KEY;

    const { videoType, videoTopic, additionalContext, videoLength, tone } =
      req.body;

    if (!videoTopic) {
      return res.status(400).json({ error: "Video topic is required" });
    }

    // Call Gemini API with the key from environment variable
    const script = await callGeminiAPI(
      videoType,
      videoTopic,
      additionalContext,
      videoLength,
      tone,
      GEMINI_API_KEY
    );

    res.json({ success: true, script });
  } catch (error) {
    console.error("Error generating script:", error);
    res.status(500).json({ error: error.message });
  }
});

async function callGeminiAPI(
  type,
  topic,
  context,
  length,
  tone,
  GEMINI_API_KEY
) {
  const apiUrl = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent`;

  const prompt = `
You are a professional scriptwriter. Write a detailed ${type} script.

🎯 Topic: ${topic}
📝 Additional Context: ${context || "No extra details"}
🎬 Desired Video Length: ${length} minutes
🎤 Tone of Delivery: ${tone}

Instructions:

The script must be audience-friendly, structured, and engaging.

The script length must match the desired duration (${length} minutes).

Maintain a natural speaking pace of 140–160 words per minute (so total word count ≈ ${
    length * 240
  } words).

Keep content evenly paced from start to finish.

Include an introduction, key sections, and a closing call-to-action (like, subscribe, follow, etc.).

Do not include timestamps — only clean script text.

Now generate the final ${type} script.

  `;
  const payload = {
    contents: [
      {
        parts: [{ text: prompt }],
      },
    ],
  };

  const response = await fetch(apiUrl, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-goog-api-key": GEMINI_API_KEY,
    },
    body: JSON.stringify(payload),
  });

  if (!response.ok) {
    const errorData = await response.json();
    throw new Error(
      errorData.error?.message || `API error: ${response.status}`
    );
  }

  const data = await response.json();

  // Extract the generated text from the response
  if (
    data.candidates &&
    data.candidates[0] &&
    data.candidates[0].content &&
    data.candidates[0].content.parts &&
    data.candidates[0].content.parts[0]
  ) {
    return data.candidates[0].content.parts[0].text;
  } else {
    throw new Error("Unexpected response format from Gemini API");
  }
}

app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});
