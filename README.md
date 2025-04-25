# Free Fall Math Game - Mobile Edition

This is the mobile version of the Free Fall Math game that automatically detects mobile devices and provides a touch-friendly interface.

## Features

- Automatic device detection (mobile vs. desktop)
- Touch-optimized controls with virtual D-pad
- Responsive UI design that adapts to different screen sizes
- Same gameplay experience as the desktop version

## How to Play

1. When a player joins, the game automatically detects if they're on a mobile device
2. Mobile players will see a touch-friendly interface with a virtual D-pad
3. Solve math problems by navigating to the block with the correct answer
4. Complete 10 questions to finish the game

## Running the Mobile Version

To run the mobile version of the game:

-download hytopia app
-choose Free Fall game
-choose server
-select play game 

## Technical Details

The mobile version uses the same core gameplay as the desktop version but with these enhancements:

- Device detection using browser features (touch support, screen size, etc.)
- Optimized UI layout for smaller screens
- Touch controls for navigation
- Responsive design with CSS media queries

## Implementation Notes

The mobile implementation maintains compatibility with the original browser version:

- Mobile-specific UI is loaded only for mobile devices
- Desktop players still get the regular interface
- Game logic remains the same for both versions
- Detection happens client-side using web features 

## Required Assets

For the mobile UI to work properly, you need to add the following icons to the `assets/icons` directory:

- `arrow-up.png` - Arrow icon for the up direction
- `arrow-down.png` - Arrow icon for the down direction
- `arrow-left.png` - Arrow icon for the left direction
- `arrow-right.png` - Arrow icon for the right direction

You can use simple triangle shapes with a transparent background for these icons. Each icon should be approximately 24x24 pixels in size. 
