# Plan tabs use internal slice state

Plan tabs navigate from a reading plan to a plan slice by changing the tab's internal active slice state rather than pushing the regular plan-slice route. This keeps the tab anchored to the followed reading plan, lets back return from the slice to the plan inside the same workspace tab, and avoids mixing app-switcher state with the navigation stack.
