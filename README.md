# ReflectivAI - AI Sales Enablement for Life Sciences

**Intelligent coaching that blends clinical accuracy, emotional intelligence, and adaptive AI to transform every HCP conversation.**

[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](https://opensource.org/licenses/MIT)
[![Deployment](https://img.shields.io/badge/Deployment-GitHub%20Pages-success)](https://reflectivei.github.io/reflectiv-ai/)
[![Status](https://img.shields.io/badge/Status-Production-green)](https://reflectivei.github.io/reflectiv-ai/)

---

## 🌟 Overview

ReflectivAI is a cutting-edge AI-powered sales enablement platform designed specifically for life sciences organizations. It combines clinical precision, emotional intelligence (EI), and adaptive coaching to help pharmaceutical sales representatives deliver authentic, confident, and compliant conversations with healthcare providers (HCPs).

### Key Features

✅ **Always Compliant** - Label-only content with automated guardrails  
✅ **Instantly Scalable** - Deploy across your entire field force in days  
✅ **Measurable Impact** - Track EI growth and business outcomes together  
✅ **Real-Time Coaching** - AI-powered feedback during conversations  
✅ **Multi-Mode Support** - Role-play, sales coaching, emotional intelligence, product knowledge  

---

## 🎯 Platform Modules

### 1. **Sales Coach**
AI-driven coaching for real-time sales conversations, providing instant feedback on messaging, objection handling, and compliance.

### 2. **Product Knowledge**
Comprehensive therapeutic area coverage with label-accurate information:
- Cardiovascular disease
- COVID-19
- HIV/AIDS
- Oncology
- And more...

### 3. **Role Play**
Realistic HCP conversation simulations for practice and skill development before critical meetings.

### 4. **Relationship Intelligence (Emotional Intelligence)**
Advanced EI coaching with 10-dimension scoring:
- Empathy Recognition
- Active Listening
- Emotional Adaptability
- Clarity of Communication
- Resilience & Confidence
- And more...

---

## 📊 Performance Analytics & Coaching Intelligence

ReflectivAI provides comprehensive performance tracking with **10 key metrics**:

| Metric | Score | Description |
|--------|-------|-------------|
| **Accuracy Index** | 94% | Precision in clinical statements and product information |
| **Readiness Velocity** | 1.4x | Speed of preparedness improvement over time |
| **Empathy Index** | 88% | Recognition and response to emotional cues |
| **Compliance Score** | 96% | Adherence to regulatory and label guidelines |
| **Confidence Level** | 8.5/10 | Poise and assertiveness in delivery |
| **Clarity Index** | 92% | Simplicity and understanding in communication |
| **Objection Handling** | 85% | Effectiveness in addressing HCP concerns |
| **Discovery Index** | 78% | Quality of needs assessment questions |
| **Active Listening** | 90% | Attentiveness and appropriate response |
| **Emotional Adaptability** | 83% | Flexibility in adjusting to emotional shifts |

**Interactive Features:**
- Click any metric to see detailed breakdown
- View calculation methodology
- See performance indicators
- Review sample sales dialogues

---

## 🚀 Quick Start

### For Users

1. **Visit the Platform**  
   Navigate to [https://reflectivei.github.io/reflectiv-ai/](https://reflectivei.github.io/reflectiv-ai/)

2. **Click "Request Demo"**  
   Schedule a personalized demo to explore all features

3. **Or Try "Explore Platform"**  
   Open the Feedback Coach widget and start practicing immediately

### For Developers

```bash
# Clone the repository
git clone https://github.com/ReflectivEI/reflectiv-ai.git
cd reflectiv-ai

# Start local server
python3 -m http.server 8080

# Open in browser
open http://localhost:8080
```

### Widget Embedding

Add the ReflectivAI widget to any webpage:

```html
<!-- Add to your HTML -->
<script src="https://reflectivei.github.io/reflectiv-ai/widget.js"></script>

<!-- Widget will automatically appear as a floating button -->
```

---

## 🏗️ Architecture

ReflectivAI uses a modern, modular architecture:

```
reflectiv-ai/
├── index.html              # Main landing page
├── widget.js               # Embeddable coaching widget
├── assets/
│   ├── chat/
│   │   ├── core/           # Core modules (event bus, disposables, API)
│   │   ├── modes/          # Coaching modes (EI, sales, role-play, knowledge)
│   │   └── data/           # Therapeutic area data
│   └── images/             # Site images and assets
├── docs/                   # Documentation
└── tests/                  # Automated tests
```

### Technology Stack

- **Frontend:** Vanilla JavaScript, Tailwind CSS
- **Backend:** Cloudflare Workers (serverless)
- **AI Model:** GPT-4 via Azure OpenAI
- **Hosting:** GitHub Pages
- **CDN:** Cloudflare

---

## 📖 Documentation

Comprehensive documentation is available in the `/docs` directory:

- [**User Guide**](docs/USER_GUIDE.md) - End-user instructions and best practices
- [**Developer Guide**](docs/DEVELOPER_GUIDE.md) - Technical architecture and development
- [**API Reference**](docs/API_REFERENCE.md) - Widget API and integration guide
- [**Troubleshooting**](docs/TROUBLESHOOTING.md) - Common issues and solutions
- [**Changelog**](docs/CHANGELOG.md) - Version history and updates

---

## 🧪 Testing

ReflectivAI includes comprehensive automated testing:

```bash
# Run all tests
./comprehensive-test.sh

# Test specific mode
./test-all-modes-formatting.sh

# Test EI scoring
python3 test_ei_scoring.py
```

**Test Coverage:**
- ✅ Widget loading and initialization
- ✅ All 4 coaching modes
- ✅ EI panel and scoring system
- ✅ Modal interactions
- ✅ Citation system
- ✅ Therapeutic area coverage
- ✅ Responsive design

---

## 🔧 Configuration

### Environment Variables

Set these in your Cloudflare Worker:

```bash
OPENAI_API_KEY=your-azure-openai-key
OPENAI_ENDPOINT=https://your-endpoint.openai.azure.com
DEPLOYMENT_NAME=your-deployment-name
```

### Widget Configuration

Customize widget behavior:

```javascript
// In widget.js
globalThis.COACH_ENDPOINT = 'https://your-worker.workers.dev';
globalThis.WORKER_URL = 'https://your-worker.workers.dev';
```

---

## 🎨 Customization

### Theming

ReflectivAI uses a consistent color palette:

```css
/* Primary Colors */
--primary-dark: #15395b;      /* Navy blue */
--accent-teal: #06B6D4;       /* Teal/cyan */
--card-bg: #1e3a5f;           /* Dark navy for cards */

/* Gradients */
--gradient-header: linear-gradient(135deg, #0f2747 0%, #1e3a5f 100%);
```

### Metric Cards

Customize metric cards in `index.html`:

```javascript
const metricsData = [
  {
    id: 'accuracy',
    title: 'Accuracy Index',
    score: '94%',
    definition: '...',
    calculation: '...',
    indicators: '...',
    sample: '...'
  },
  // Add more metrics...
];
```

---

## 🤝 Contributing

We welcome contributions! Please see [CONTRIBUTING.md](docs/CONTRIBUTING.md) for guidelines.

### Development Workflow

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add amazing feature'`)
4. Push to branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

### Code Standards

- Use ESLint for JavaScript linting
- Follow existing code structure
- Add tests for new features
- Update documentation

---

## 📊 Project Status

### Recent Updates

**Phase 3 - UI Enhancements (November 2025)** ✅
- Redesigned hero section with centered elements
- Added 10 new Performance Analytics metric cards
- Implemented interactive modal system
- Enhanced Platform Modules section
- Optimized responsive design

**Phase 2 - EI Panel Integration (October 2025)** ✅
- 10-dimension EI scoring system
- Real-time feedback pills
- Expandable metric details
- Modal system for comprehensive insights

**Phase 1 - Core Platform (September 2025)** ✅
- Widget architecture with modular modes
- Event bus and disposables system
- 4 coaching modes (Role-Play, Sales Coach, EI, Product Knowledge)
- Cloudflare Worker backend
- Therapeutic area coverage

### Roadmap

**Phase 4 - Documentation (Current)** 🔄
- Comprehensive user guides
- Developer documentation
- API reference
- Troubleshooting guides

**Phase 5 - Advanced Analytics (Planned)** 📋
- Team-level dashboards
- Historical trend analysis
- Benchmarking against peers
- Custom metric creation

**Phase 6 - Mobile App (Planned)** 📋
- iOS and Android applications
- Offline mode support
- Push notifications
- Voice input

---

## 📄 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

---

## 🙋 Support

### Get Help

- **Email:** support@reflectivai.com
- **Documentation:** [docs/](docs/)
- **Issues:** [GitHub Issues](https://github.com/ReflectivEI/reflectiv-ai/issues)

### Enterprise Support

For enterprise licensing and dedicated support:
- **Contact:** enterprise@reflectivai.com
- **Website:** [https://reflectivai.com](https://reflectivai.com)

---

## 🎓 About

ReflectivAI is developed by a team of AI researchers, pharmaceutical industry experts, and behavioral scientists committed to transforming sales enablement in life sciences.

**Mission:** Empower every pharmaceutical sales representative with AI-driven coaching that builds authentic, compliant, and impactful relationships with healthcare providers.

---

## 🔗 Links

- **Production Site:** [https://reflectivei.github.io/reflectiv-ai/](https://reflectivei.github.io/reflectiv-ai/)
- **GitHub Repository:** [https://github.com/ReflectivEI/reflectiv-ai](https://github.com/ReflectivEI/reflectiv-ai)
- **Documentation:** [docs/](docs/)
- **Issue Tracker:** [GitHub Issues](https://github.com/ReflectivEI/reflectiv-ai/issues)

---

**Built with ❤️ for the life sciences community**

*Last Updated: November 13, 2025*
