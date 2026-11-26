"""Where the daily-reading workflow reads its sources and writes its files.

The sources are not in the repository: the reviewed meditations, the calendar and the scene
library live in an authoring workspace (DAILY_READINGS_WORKSPACE, by default the portraits
folder beside this checkout). The Firestore export and every built file go to
apps/resource-studio/outputs/daily-readings/, which Git ignores.
"""
import os
import pathlib

STUDIO = pathlib.Path(__file__).resolve().parents[3]
WORKSPACE = pathlib.Path(
    os.environ.get('DAILY_READINGS_WORKSPACE', '~/Projects/bible-strong/portraits/verse-of-the-day')
).expanduser()
PRODUCTION = WORKSPACE / 'production'
SCENE_LIBRARY = WORKSPACE / 'library-1'
OUT = STUDIO / 'outputs' / 'daily-readings'
BUILD = OUT / 'build'
