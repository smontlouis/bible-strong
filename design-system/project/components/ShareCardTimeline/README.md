The share cards of the timeline: its section, and an event with or without a picture.

They use the frame described in `ShareCardBible`, with the right half given to pictures. Every event of the timeline names pictures; the card shows one when its file can be fetched and falls back on the plain frame when it cannot.

- **The section** sets its title and its figures on the left half and four pictures of well-known events on the right half, each in a white frame with `radius-xl` corners, slightly turned, with the name of its event in a pill.
- **An event with a picture** sets its name at 120px, its dates in the chip and an excerpt of three lines at most on the left half, and its first picture on the right half, in the same white frame.
- **An event without a picture** keeps the whole width: its name, then an excerpt of two lines.

A picture is cropped to fill its frame, never stretched. A card with pictures is a JPEG or a PNG of more than 300 KB: it is the one exception to the flat image.

The consumer provides the name, the dates as the page prints them, the first sentences of the description and the address of the first picture. The pictures come from the source of the timeline, not from this repository.
