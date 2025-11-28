/**
 * @ai-context Test suite for BMAD personas
 * @ai-invariant All personas must be loadable and functional
 * @ai-connection Tests validate persona integration and workflow
 */
const ProjectManager = require('../../personas/project-manager');
const Architect = require('../../personas/architect');
const Developer = require('../../personas/developer');
const QA = require('../../personas/qa');
const Security = require('../../personas/security');
const DevOps = require('../../personas/devops');
const ReleaseManager = require('../../personas/release-manager');

describe('BMAD Personas', () => {
    const mockToken = 'mock-github-token';

    describe('Persona Loading', () => {
        test('Project Manager should load correctly', () => {
            const pm = new ProjectManager(mockToken);
            expect(pm.name).toBe('PM Agent');
            expect(pm.role).toBe('PM');
            expect(pm.githubToken).toBe(mockToken);
        });

        test('Architect should load correctly', () => {
            const architect = new Architect(mockToken);
            expect(architect.name).toBe('Architect Agent');
            expect(architect.role).toBe('Architect');
        });

        test('Developer should load correctly', () => {
            const developer = new Developer(mockToken);
            expect(developer.name).toBe('Developer Agent');
            expect(developer.role).toBe('Developer');
        });

        test('QA should load correctly', () => {
            const qa = new QA(mockToken);
            expect(qa.name).toBe('QA Agent');
            expect(qa.role).toBe('QA');
        });

        test('Security should load correctly', () => {
            const security = new Security(mockToken);
            expect(security.name).toBe('Security Agent');
            expect(security.role).toBe('Security');
        });

        test('DevOps should load correctly', () => {
            const devops = new DevOps(mockToken);
            expect(devops.name).toBe('DevOps Agent');
            expect(devops.role).toBe('DevOps');
        });

        test('Release Manager should load correctly', () => {
            const releaseManager = new ReleaseManager(mockToken);
            expect(releaseManager.name).toBe('Release Manager Agent');
            expect(releaseManager.role).toBe('Release Manager');
        });
    });

    describe('Persona Methods', () => {
        test('All personas should have execute method', () => {
            const personas = [
                new ProjectManager(mockToken),
                new Architect(mockToken),
                new Developer(mockToken),
                new QA(mockToken),
                new Security(mockToken),
                new DevOps(mockToken),
                new ReleaseManager(mockToken)
            ];

            personas.forEach(persona => {
                expect(typeof persona.execute).toBe('function');
                expect(typeof persona.updateActiveContext).toBe('function');
                expect(typeof persona.microCommit).toBe('function');
                expect(typeof persona.createIssue).toBe('function');
                expect(typeof persona.log).toBe('function');
            });
        });

        test('Context management should work', () => {
            const pm = new ProjectManager(mockToken);
            expect(pm.context).toBeDefined();
            expect(typeof pm.context).toBe('object');
        });
    });

    describe('Workflow Integration', () => {
        test('All personas should be available for workflow', () => {
            const personas = {
                pm: ProjectManager,
                architect: Architect,
                developer: Developer,
                qa: QA,
                security: Security,
                devops: DevOps,
                releaseManager: ReleaseManager
            };

            expect(Object.keys(personas)).toHaveLength(7);
            Object.values(personas).forEach(PersonaClass => {
                expect(typeof PersonaClass).toBe('function');
            });
        });
    });
});
