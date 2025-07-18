# Free Fall Math Game - Enhanced with Power-Ups

A Hytopia children's educational game featuring falling through a numbered tunnel while solving math problems, now enhanced with an exciting power-up system!

## Features

### Core Gameplay
- Math problem solving while falling through a numbered tunnel
- Three difficulty levels: Beginner, Moderate, and Hard  
- Automatic device detection (mobile vs. desktop)
- Touch-optimized controls with virtual D-pad for mobile devices
- Responsive UI design that adapts to different screen sizes
- Complete 10 questions to finish the game

### Power-Up System
- **5 Unique Power-ups** that spawn randomly above answer blocks (30% chance):
  - 🛡️ **Shield Bubble**: Protects from one wrong answer
  - ⏳ **Slow Motion**: Reduces falling speed for 8 seconds  
  - 🧲 **Magnet Mode**: Attracts answer blocks for 10 seconds
  - 💰 **Double Points**: Doubles score for 15 seconds
  - ⏪ **Rewind**: Allows undoing last wrong answer once
- Real-time UI indicators showing active power-ups with timers
- Visual and audio feedback for power-up collection and usage

## How to Play

1. When a player joins, the game automatically detects if they're on a mobile device
2. Mobile players will see a touch-friendly interface with a virtual D-pad
3. Solve math problems by navigating to the block with the correct answer
4. Collect power-ups floating above answer blocks for strategic advantages
5. Use power-ups wisely to maximize your score and protect against mistakes
6. Complete 10 questions to finish the game

## Running the Game

To run the game:
- Download Hytopia app
- Choose Free Fall game  
- Choose server
- Select play game

## Technical Details

### Mobile Compatibility
- Device detection using browser features (touch support, screen size, etc.)
- Optimized UI layout for smaller screens
- Touch controls for navigation
- Responsive design with CSS media queries

### Power-Up Architecture
- Entity-based power-up system with floating animations
- PowerUpManager singleton for centralized state management
- Integration with existing game mechanics (scoring, collision detection)
- Real-time UI updates with visual indicators and timers

## Implementation Notes

The game maintains compatibility across all platforms:
- Mobile-specific UI is loaded only for mobile devices
- Desktop players get the regular interface
- Game logic remains consistent for both versions
- Power-up system works seamlessly on all platforms
- Detection happens client-side using web features

## Required Assets

For the mobile UI to work properly, you need to add the following icons to the `assets/icons` directory:

- `arrow-up.png` - Arrow icon for the up direction
- `arrow-down.png` - Arrow icon for the down direction
- `arrow-left.png` - Arrow icon for the left direction
- `arrow-right.png` - Arrow icon for the right direction

You can use simple triangle shapes with a transparent background for these icons. Each icon should be approximately 24x24 pixels in size. 
>>>>>>> ec9e9553557e6873d1786f5c61072f34930d6ec4
