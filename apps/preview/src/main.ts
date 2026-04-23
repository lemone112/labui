/**
 * Preview app entry — bootstraps the token-matrix page and wires up
 * the mode/contrast controls.
 */

import './styles.css'
import { render } from './app'

const root = document.getElementById('app')
if (!root) throw new Error('#app root missing in index.html')
render(root)
