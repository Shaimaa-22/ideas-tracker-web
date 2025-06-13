# Ideas Tracker – Thoughts Tracking System

Ideas Tracker is a smart web app that helps users **capture, enhance, and organize their ideas** using AI.

It allows voice input, converts speech to text, and leverages GPT to rephrase and expand thoughts — giving users better clarity and creativity.

##  Features

- Voice-to-text idea input
- AI-enhanced idea suggestions (GPT-powered)
- Smart organization and labeling of ideas
- Dark/Light mode toggle
- Community groups & idea sharing
- Search and filtering

## 🛠️ Technologies Used

| Feature        | Technology                     |
|----------------|------------------------------- |
| Frontend       | HTML, CSS, JavaScript          |
| Backend        | Firebase (Auth, Firestore DB, Hosting) |
| AI Processing  | OpenAI GPT API                 |
| Voice Input    | Web Speech API                 |
| Media Storage  | Cloudinary                     |


##  AI Workflow

1.  User speaks an idea → captured using Web Speech API
2. Transcribed into text
3.  Sent to OpenAI GPT API for enhancement
4.  AI returns a cleaner, richer version of the idea
5. Idea saved to Firestore with metadata (tags, group)

##  Example

**Original Idea**: “An app for students to share notes”

**AI-Enhanced**:
> “A collaborative platform where students can upload, rate, and organize class notes by topic and university course.”
## 🚀 Future Work

-  AI-based mind map generation
-  Sentiment tagging of ideas
-  Mobile PWA version
-  Chrome Extension integration
-  Recommendation system for related ideas & users

## Developer

Shaymaa – Graduation Project (2025)  
Department of Software Engineering  

## License

This project is built for academic and demonstration purposes.  
To use the OpenAI API, users must bring their own API key.

These future features aim to make Ideas Tracker a more intelligent and personalized thinking assistant.
